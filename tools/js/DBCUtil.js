const MAGIC_NUMBER = 1128416343; // WDBC
const debug = false; // debug mode

loadFrom = async (file) => {
    if (typeof file === 'string') {
        return await fetch(file).then(res => res.arrayBuffer());
    }
    if (file instanceof ArrayBuffer) {
        return file;
    }
    if (file instanceof Blob) {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = () => reject(fileReader.error);
            fileReader.readAsArrayBuffer(file);
        })
    }
    throw new Error(`Invalid file: ${file}`);
}

createFrom = async (file, delimiter = ',') => {
    if (typeof file === 'string') {
        const text = await (await fetch(file)).text();
        const rows = text.split(/\r\n/g);
        const columnHeaders = rows.shift().split(delimiter);
        return rows.map(row => {
            const columns = row.split(delimiter);
            const obj = {};
            columnHeaders.forEach((header, i) => {
                obj[header] = columns[i];
            });
            return obj;
        })

    }

    if (file instanceof Blob) {
        const text = await new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = () => reject(fileReader.error);
            fileReader.readAsText(file);
        });

        const rows = text.split(/\r\n/g);
        const columnHeaders = rows.shift().split(delimiter);
        return rows.map(row => {
            const columns = row.split(delimiter);
            const obj = {};
            columnHeaders.forEach((header, i) => {
                obj[header] = columns[i];
            });
            return obj;
        });
    }

    if (file instanceof Array) {
        return file;
    }

    throw new Error(`Invalid file: ${typeof file}`);
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
        const typeSizes = {
            'long': 4,
            'str': 4,
            'float': 4,
            'flags': 4,
            'bool': 1
        };
        return schema.fields.reduce((size, field) => {
            if (!typeSizes[field.type]) {
                throw new Error(`Invalid field type: ${field.type}`);
            }
            return size + typeSizes[field.type];
        }, 0);
    }

    read = async () => {
        const schema = await this.getSchema();

        this.magic = 0;
        this.record_count = 0;
        this.field_count = 0;
        this.record_size = 0;
        this.string_block_size = 0;

        return loadFrom(this.path).then(buffer => {
            if (debug) console.log(buffer);
            const view = new DataView(buffer);
            let offset = 0;

            this.magic = view.getUint32(offset, true);
            offset += 4;
            if (this.magic !== MAGIC_NUMBER) throw new Error(`Invalid magic number: ${this.magic}`);
            this.record_count = view.getUint32(offset, true);
            offset += 4;
            this.field_count = view.getUint32(offset, true);
            offset += 4;
            this.record_size = view.getUint32(offset, true);
            offset += 4;
            this.string_block_size = view.getUint32(offset, true);
            offset += 4;

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
                        case 'flags':
                            row[field.name] = `0x${Number(view.getUint32(offset, true)).toString(16)}`;
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

            if (debug) {
                console.log(
                    `=============== Read Debug ===============`
                );
                console.log(
                    `Magic: ${this.magic}\n` +
                    `Record count: ${this.record_count}\n` +
                    `Field count: ${this.field_count}\n` +
                    `Record size: ${this.record_size}\n` +
                    `String block size: ${this.string_block_size}\n`
                );
                console.log(this.rows)
            }

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

        return createFrom(this.path).then(array => {
            this.magic = MAGIC_NUMBER;
            this.record_count = array.length;
            this.field_count = schema.fields.length;
            this.record_size = this.getRecordSize(schema);

            this.string_block[0] = '';
            this.string_block_size++;

            for (let row of array) {
                for ( let field of schema.fields ) {
                    if (field.type === 'str' && !this.string_block.includes(row[field.name])) {
                        this.string_block[this.string_block_size] = row[field.name];
                        this.string_block_size += row[field.name].length + 1;
                    }
                }
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

            for (let row of array) {
                for ( let field of schema.fields ) {
                    const value = row[field.name];
                    switch (field.type) {
                        case 'str':
                            view.setUint32(offset, this.string_block.indexOf(value), true);
                            offset += 4;
                            break;
                        case 'long':
                            view.setInt32(offset, value, true);
                            offset += 4;
                            break;
                        case 'flags':
                            view.setUint32(offset, parseInt(value, 16), true);
                            offset += 4;
                            break;
                        case 'float':
                            view.setFloat32(offset, value, true);
                            offset += 4;
                            break;
                        case 'bool':
                            view.setUint8(offset, value, true);
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

            if (debug) {
                console.log(
                    `=============== Write Debug ===============`
                )
                console.log(
                    `Magic: ${this.magic}\n` +
                    `Record count: ${this.record_count}\n` +
                    `Field count: ${this.field_count}\n` +
                    `Record size: ${this.record_size}\n` +
                    `String block size: ${this.string_block_size}\n`

                );
                console.log(`String block:`);
                console.log(this.string_block);
            }

            return buffer;

        })
    }
}



