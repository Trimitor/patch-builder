let d = {}, ld = {}, temp = {};
let gc = 0;

const configurator = document.getElementById('configurator');
const build = document.getElementById('build');
const preview = document.getElementById('preview');
const langSelect = document.getElementById('lang-select');
const dbcData = {
  path: 'dbcs/creaturedisplayinfo.dbc',
  schema: 'schemas/creaturedisplayinfo.json'
}
const mpqData = [
  temp,
  'dbcs/creaturemodeldata.dbc',
]

addGroup = async () => {
  const group = document.createElement('div');
  group.id = `group-${gc}`;
  group.className = 'input-group mb-3';

  const origsel = createSelect('original', gc);
  const swapsel = createSelect('swapped', gc);
  const delbtn = createDeleteButton(gc);

  group.appendChild(origsel);
  group.appendChild(swapsel);
  group.appendChild(delbtn);
  configurator.appendChild(group);

  origsel.addEventListener('change', () => {
    loadSwaps(origsel, swapsel);
  });

  delbtn.addEventListener('click', () => {
    configurator.removeChild(group);
  });

  group.addEventListener('mouseover', () => {
    showPreview(origsel, swapsel);
  });

  gc++;
};

createSelect = (type, gc) => {
  const select = document.createElement('select');
  select.id = `${type}-${gc}`;
  select.className = 'form-select';
  const disabledOption = document.createElement('option');
  disabledOption.disabled = true;
  disabledOption.selected = true;
  disabledOption.innerHTML = 'Select...';
  disabledOption.value = -1;
  select.appendChild(disabledOption);

  d.data.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.groupid;
    option.innerHTML = item.name;
    select.appendChild(option);
  });

  return select;
}

createDeleteButton = (gc) => {
  const delbtn = document.createElement('button');
  delbtn.id = `delete-${gc}`;
  delbtn.className = 'btn btn-outline-danger';
  delbtn.type = 'button';
  delbtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

  return delbtn;
}

loadSwaps = async (o, s) => {
  s.innerHTML = '<option selected disabled value="-1">Select...</option>';
  const group = d.data.find(item => item.groupid == o.value);
  if (group) {
    group.to.forEach(({id, name}) => {
      s.innerHTML += `<option value="${id}">${name}</option>`;
    });
  }
};

buildPatch = async () => {
  if (langSelect.value !== "-1") {
    build.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Wait...`;
    build.classList.add('disabled');

    for (let g of configurator.children) {
      const [o, s] = g.children;
      await makeSwap(o, s);
    }

    const worker = new Worker('js/worker.js');
    worker.postMessage({ path: temp, schema: dbcData.schema });

    worker.addEventListener('message', async (e) => {
      build.innerHTML = `<i class="fa-solid fa-download"></i> Download`;
      build.className = 'btn btn-success';
      build.removeEventListener('click', buildPatch);
      const file = new Blob([e.data], { type: 'application/octet-stream' });

      /*let archive = new JSZip();
      archive.folder(`patch-${langSelect.value}-x.mpq/DBFilesClient`)
        .add('CreatureDisplayInfo.dbc', file)
        .file(mpqData[1]);*/


      build.href = URL.createObjectURL(file); // archive.generate({ type: 'blob' });
      build.download = `creaturedisplayinfo-${langSelect.value}.dbc`;
      temp = ld; // reset temp
    });
  }
}

const addNew = document.getElementById('add');
addNew.addEventListener('click', addGroup);

window.addEventListener('load', async () => {
  d = await fetch('swaps/list.json').then(res => res.json());

  build.innerHTML = `<i class="fa-solid fa-gears"></i> Build`;
  build.addEventListener('click', buildPatch)

  const openDBC = new DBC(dbcData.path, dbcData.schema);
  ld = await openDBC.read();

  temp = ld;

  addGroup();
})

makeSwap = async (o, s) => {
  if (o.value !== -1 && s.value !== -1) {
    const response = await fetch(`swaps/${o.value}/${s.value}.hdc`);
    const swaps = await response.text();
    const swapRows = swaps.split("\n").map(row => row.split(","));

    for (let i = 1; i < swapRows.length; i++) {
      let record = temp.find(x => x[swapRows[0][0]] == swapRows[i][0])
      if (record) {
        Object.assign(record, swapRows[i].reduce((obj, value, index) => {
          obj[swapRows[0][index]] = value;
          return obj;
        }, {}));
      }
    }
  }
}

showPreview = async (o, s) => {
  if (o.value !== -1 && s.value !== -1) {
    const group = d.data.find(x => x.groupid == o.value);
    if (group) {
      const previewUrl = group.to.find(x => x.id == s.value)?.preview;
      if (previewUrl) {
        preview.innerHTML = `<img class="img-fluid" src="${previewUrl}">`;
      }
    }
  }
}