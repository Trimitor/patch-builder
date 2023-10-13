const configurator = document.getElementById('configurator');
const build = document.getElementById('build');
const dbc = {
    path: 'files/creaturedisplayinfo.dbc',
    schema: 'schemas/creaturedisplayinfo.json'
}
let data, loadedbc;
let gc = 0;

addGroup = async () => {
    const group = document.createElement('div');
    group.id = `group-${gc}`;
    group.classList.add('input-group', 'mb-3');

    const origsel = document.createElement('select');
    origsel.id = `original-${gc}`;
    origsel.classList.add('form-select');
    origsel.innerHTML = '<option selected disabled>Выберите...</option>';
    origsel.addEventListener('change', () => {
        build.addEventListener('click', async () => {
            await buildPatch();
        })
        build.innerHTML = `<i class="fa-solid fa-gears"></i> Build`;
        build.className = 'btn btn-light';

        loadSwaps(origsel.value);
    })

    const swapsel = document.createElement('select');
    swapsel.id = `swapped-${gc}`;
    swapsel.classList.add('form-select');
    swapsel.innerHTML = '<option selected disabled>Выберите...</option>';

    const delbtn = document.createElement('button');
    delbtn.id = `delete-${gc}`;
    delbtn.classList.add('btn', 'btn-outline-danger');
    delbtn.type = 'button';
    delbtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    delbtn.addEventListener('click', () => {
        configurator.removeChild(group);
    });

    group.appendChild(origsel);
    group.appendChild(swapsel);
    group.appendChild(delbtn);
    configurator.appendChild(group);

    gc++;
}

loadSwaps = async (id) => {
    const swapsel = document.getElementById(`swapped-${id}`);
    swapsel.innerHTML = '<option selected disabled>Выберите...</option>';
    for (const [key, value] of Object.entries(data)) {
        const option = document.createElement('option');
        option.value = key;
        option.innerHTML = value.name;
        swapsel.appendChild(option);
    }
}

buildPatch = async () => {
    build.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Wait...`;
    build.disabled = true;

    for (let i = 0; i < configurator.childNodes.length; i++) {
        const group = configurator.children[i].id.split('-')[1];
        await makeSwap(group);
    }
    
    const worker = new Worker('js/DBCUtil.js');

    worker.postMessage({
        path: loadedbc,
        schema: dbc.schema,
    });

    worker.addEventListener('message', async (e) => {
        build.innerHTML = `<i class="fa-solid fa-download"></i> Download`;
        build.className = 'btn btn-success';
        build.removeEventListener('click', buildPatch);
        const file = new Blob([e.data], { type: 'application/octet-stream' });
        build.href = URL.createObjectURL(file);
        build.download = 'CreatureDisplayInfo.dbc';
    })
}

const addNew = document.getElementById('add');
addNew.addEventListener('click', addGroup);

window.addEventListener('load', async () => {
    data = await fetch('swaps/list.json').then(res => res.json());
    addGroup();
    build.innerHTML = `<i class="fa-solid fa-gears"></i> Build`;
    build.addEventListener('click', buildPatch)

    const openDBC = new DBC(dbc.path, dbc.schema);
    loadedbc = await openDBC.read();
    console.log(loadedbc);
})

makeSwap = async (id) => {
    const swapsel = document.getElementById(`swapped-${id}`);
    const selected = swapsel.options[swapsel.selectedIndex].value;
    const origsel = document.getElementById(`original-${id}`);
    const original = origsel.options[origsel.selectedIndex].value;

    const swaps = await fetch(`swaps/${original}/${selected}.hdc`).then(res => {
        return res.text().split("\n").map(
            function(row) {
                return row.split(",");
            }
        )
    });

    const swapData = swaps[selected];

    for (let i = 0; i < loadedbc.length; i++) {
        if (loadedbc[i][0] == swapData[0]) {
            console.log(loadedbc[i]);
            for (let j = 0; j < loadedbc[i].length; j++) {
                loadedbc[i][j] = swapData[j];
            }
        }
        break;
    }
}