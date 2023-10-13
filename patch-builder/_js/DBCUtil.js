const MAGIC_NUMBER = 1128416343; // WDBC
const debug = false; // debug mode

fromDBC = async (file) => {
    switch (typeof (file)) {
        case 'string':
            return await fetch(file).then(res => res.arrayBuffer());
        case 'object':
            if (file instanceof ArrayBuffer) { return file; }
            if (file instanceof Blob) {
                const fileReader = new FileReader();
                return new Promise((resolve, reject) => {
                    fileReader.onload = () => resolve(fileReader.result);
                    fileReader.onerror = () => reject(fileReader.error);
                    fileReader.readAsArrayBuffer(file);
                })
            }
        default:
            throw new Error(`Invalid file: ${file}`);
    }
}

fromCSV = async (file, delimiter = ',', header = false) => {
    switch (typeof (file)) {
        case 'string':
            return await fetch(file).then(res => res.text()).then(text => {
                text.split('\n').map(line => {
                    const row = line.split(delimiter);
                    if (header) {
                        row.shift();
                    }
                    return row;
                })
            })
        case 'object':
            if (file instanceof Blob) {
                let rows = [];
                const fileReader = new FileReader();
                return new Promise((resolve, reject) => {
                    fileReader.onload = () => resolve(fileReader.result);
                    fileReader.onerror = () => reject(fileReader.error);
                    fileReader.readAsText(file);
                }).then(text => {
                    text.split('\r\n').map(line => {
                        const row = line.split(delimiter);
                        rows.push(row);
                    })
                    if (header) {
                        rows.shift();
                    }
                    return rows;
                })

            }
        default:
            throw new Error(`Invalid file: ${typeof (file)}`);
    }
}

toCSV = (obj) => {
    const lineBreak = '\r\n';
    const delimiter = ',';

    const header = Object.keys(obj[0]);
    const rows = obj.map(row => header.map(fieldName => row[fieldName]).join(delimiter));

    return [header.join(delimiter), ...rows].join(lineBreak);
}

class DBC {
    constructor(path, schemaPath) {
        if (!path) throw new Error('path is required');
        if (!schemaPath) throw new Error('schemaPath is required');
        this.path = path;
        this.schemaPath = schemaPath;
    }

    getSchema = async () => {
        const schema = await fetch(`${this.schemaPath}`).then(res => res.json());
        if (debug) console.log(schema);
        return schema;
    }

    getRecordSize = (schema) => {
        let record_size = 0;
        schema.fields.forEach(field => {
            switch (field.type) {
                case 'long':
                    record_size += 4;
                    break;
                case 'str':
                    record_size += 4;
                    break;
                case 'float':
                    record_size += 4;
                    break;
                case 'byte':
                    record_size += 1;
                default:
                    throw new Error(`Invalid field type: ${field.type}`);
            }
        });
        return record_size;
    }

    read = async () => {
        const schema = await this.getSchema();

        this.magic = 0;
        this.record_count = 0;
        this.field_count = 0;
        this.record_size = 0;
        this.string_block_size = 0;

        return fromDBC(this.path).then(buffer => {
            if (debug) console.log(buffer);
            const view = new DataView(buffer);
            let offset = 0;

            this.magic = view.getUint32(offset, true);
            offset += 4;
            if (this.magic !== MAGIC_NUMBER) throw new Error('Invalid magic number');
            this.record_count = view.getUint32(offset, true);
            offset += 4;
            this.field_count = view.getUint32(offset, true);
            offset += 4;
            this.record_size = view.getUint32(offset, true);
            offset += 4;
            this.string_block_size = view.getUint32(offset, true);
            offset += 4;

            if (debug) {
                console.log(`Magic: ${this.magic}\n` +
                    `Record count: ${this.record_count}\n` +
                    `Field count: ${this.field_count}\n` +
                    `Record size: ${this.record_size}\n` +
                    `String block size: ${this.string_block_size}\n`
                );
            }

            this.rows = [];

            for (let i = 0; i < this.record_count; i++) {
                const row = {};
                for (let j = 0; j < this.field_count; j++) {
                    const field = schema.fields[j];
                    row[field.name] = '';
                    switch (field.type) {
                        case 'str':
                            let stroffest = view.getUint32(offset, true);
                            for (let k = buffer.byteLength - this.string_block_size + stroffest; k < buffer.byteLength; k++) {
                                if (view.getUint8(k, true) === 0) break;
                                row[field.name] += String.fromCharCode(view.getUint8(k, true));
                            }
                            offset += 4;
                            break;
                        case 'long':
                            row[field.name] = view.getInt32(offset, true);
                            offset += 4;
                            break;
                        case 'float':
                            row[field.name] = view.getFloat32(offset, true);
                            offset += 4;
                            break;
                        case 'bool':
                            row[field.name] = view.getUint8(offset);
                            offset += 1;
                            break;
                        default:
                            throw new Error(`Invalid field type: ${field.type}`);
                    }
                }
                this.rows.push(row);
            }

            if (debug) console.log(this.rows);

            return this.rows;


        })
    }

    toCSV = async () => {
        const res = await this.read();
        return toCSV(res);
    }

    write = async () => {
        const schema = await this.getSchema();

        this.magic = 0;
        this.record_count = 0;
        this.field_count = 0;
        this.record_size = 0;
        this.string_block_size = 0;

        this.string_block = [];

        return fromCSV(this.path).then(array => {
            const header = array.shift();

            this.magic = MAGIC_NUMBER;
            this.record_count = array.length;
            this.field_count = header.length;
            this.record_size = this.getRecordSize(schema);
            
            this.string_block[0] = '';
            this.string_block_size ++;

            array.forEach((row) => {
                row.forEach((field, j) => {
                  if (schema.fields[j].type === 'str' && !this.string_block.includes(field)) {
                    this.string_block[this.string_block_size] = field;
                    this.string_block_size += field.length + 1;
                  }
                });
              });
            

            if (debug) {
                console.log(`Magic: ${this.magic}\n` +
                    `Record count: ${this.record_count}\n` +
                    `Field count: ${this.field_count}\n` +
                    `Record size: ${this.record_size}\n` +
                    `String block size: ${this.string_block_size}\n`

                );
                console.log(`String block:`);
                console.log(this.string_block);
            }

            const buffer = new ArrayBuffer(20 + this.record_count * this.record_size + this.string_block_size);
            const view = new DataView(buffer);
            let offset = 0;
            view.setUint32(offset, this.magic, true);
            offset += 4;
            view.setUint32(offset, this.record_count, true);
            offset += 4;
            view.setUint32(offset, this.field_count, true);
            offset += 4;
            view.setUint32(offset, this.record_size, true);
            offset += 4;
            view.setUint32(offset, this.string_block_size, true);
            offset += 4;

            for (let row = 0; row < this.record_count; row++) {
                for (let col = 0; col < this.field_count; col++) {
                    const field = schema.fields[col];
                    const value = array[row][col];
                    
                    switch (field.type) {
                        case 'str':
                            view.setUint32(offset, this.string_block.indexOf(value), true);
                            offset += 4;
                            break;
                        case 'long':
                            view.setInt32(offset, value, true);
                            offset += 4;
                            break;
                        case 'float':
                            view.setFloat32(offset, value, true);
                            offset += 4;
                            break;
                        case 'byte':
                            view.setUint8(offset, value);
                            offset += 1;
                            break;
                        default:
                            throw new Error(`Invalid field type: ${field.type}`);
                    }
                }
            }

            this.string_block.forEach(str => {
                for (let i = 0; i < str.length; i++) {
                    view.setUint8(offset, str.charCodeAt(i));
                    offset += 1;
                }
                view.setUint8(offset, 0);
                offset += 1;
            });

            return buffer;

        })
    }

    fromCSV = async () => {
        return await this.write();
    }
}

onmessage = async (event) => {
    const dbc = new DBC(event.data.path, '../' + event.data.schema);
    const res = await dbc.fromCSV();
    postMessage(res);
}



