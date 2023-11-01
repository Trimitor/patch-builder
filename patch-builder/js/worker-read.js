importScripts("DBCUtil.js");

onmessage = async (e) => {
    const { path, schema } = e.data;
    console.log(path, schema);
    const obj = new DBC(`../${path}`, `../${schema}`);
    const result = await obj.read();
    postMessage(result);
}