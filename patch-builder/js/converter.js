const input_dbc = document.getElementById('dbc-file');
input_dbc.addEventListener('change', async () => {
    const file = input_dbc.files[0];
    const schema = input_dbc.files[0].name.split('.').slice(0, -1).join('.');
    const dbc = new DBC(file, schema)
    const csvContent = await dbc.toCSV();

    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${input_dbc.files[0].name.split('.').slice(0, -1).join('.')}.csv`);
    link.innerHTML = 'Download CSV';
    document.body.appendChild(link);
});

const input_csv = document.getElementById('csv-file');
input_csv.addEventListener('change', async () => {
    const file = input_csv.files[0];
    const schema = input_csv.files[0].name.split('.').slice(0, -1).join('.');
    const dbc = new DBC(file, schema)
    const csvContent = await dbc.write();
    console.log(csvContent);
})