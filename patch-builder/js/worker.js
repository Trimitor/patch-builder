importScripts("DBCUtil.js");

onmessage = async (e) => {
    const { path, schema } = e.data;
    const wdbc = new DBC(path, `../${schema}`);
    const result = await wdbc.write();
    postMessage(result);
}