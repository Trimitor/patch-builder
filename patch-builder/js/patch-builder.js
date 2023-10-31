let list = {};
let dbc = {};
let temp = {};
let gc = 0;
const constants = {
  lang: {
    enUS: "English (US)",
    enGB: "English (UK)",
    deDE: "German",
    esES: "Spanish",
    esMX: "Mexican",
    frFR: "French",
    koKR: "Korean",
    ruRU: "Russian",
    zhCN: "Chinese",
    enCN: "Chinese (English voice)",
    zhTW: "Taiwanese",
  },
  swaplist: "swaps/list.json",
  dbcs: [
    {
      CreatureDisplayInfo: "dbcs/default/creaturedisplayinfo.dbc",
      CreatureModelData: "dbcs/default/creaturemodeldata.dbc",
    },
    {
      CreatureDisplayInfo: "dbcs/hdclient/creaturedisplayinfo.dbc",
      CreatureModelData: "dbcs/hdclient/creaturemodeldata.dbc",
    },
  ],
  schemas: {
    CreatureDisplayInfo: "schemas/creaturedisplayinfo.json",
    CreatureModelData: "schemas/creaturemodeldata.json",
  },
};

const configurator = document.getElementById("configurator");
const build = document.getElementById("build");
const preview = document.getElementById("preview");
const langselect = document.getElementById("lang-select");
const addbtn = document.getElementById("add");
const ishd = document.getElementById("ishd");

window.addEventListener("load", async () => {
  loadLangs();
  build.innerHTML = `<i class="fa-solid fa-cogs"></i> Build`;
  await loadList(constants.swaplist);

  addbtn.addEventListener("click", async () => {
    addGroup();
  });

  build.addEventListener("click", async () => {
    await validateBeforeBuild();
  });

  langselect.addEventListener("change", async () => {
    langselect.classList.remove("is-invalid");
  });

  addGroup();
});

loadList = async (url) => {
  const response = await fetch(url);
  list = await response.json();
};

loadLangs = () => {
  langselect.innerHTML =
    '<option selected disabled value="-1">Select language...</option>';
  for (const [key, value] of Object.entries(constants.lang)) {
    langselect.innerHTML += `<option value="${key}">${value}</option>`;
  }
};

addGroup = () => {
  const group = document.createElement("div");
  group.id = `group-${gc}`;
  group.className = "input-group mb-3";

  const [o, s, d] = [ocreate(gc), screate(gc), bcreate(gc)];

  [o, s, d].forEach((el) => group.appendChild(el));

  configurator.appendChild(group);

  o.addEventListener("change", () => {
    loadSwaps(o, s);
    o.classList.remove("is-invalid");
  });
  s.addEventListener("change", () => {
    loadPreview(o, s);
    s.classList.remove("is-invalid");
  });
  d.addEventListener("click", () => configurator.removeChild(group));

  gc++;
};

ocreate = (gc) => {
  const select = document.createElement("select");
  select.id = `original-${gc}`;
  select.className = "form-select";
  select.innerHTML = '<option selected disabled value="-1">Select...</option>';
  for (let el of list.data) {
    select.innerHTML += `<option value="${el.groupid}">${el.name}</option>`;
  }
  return select;
};

screate = (gc) => {
  const select = document.createElement("select");
  select.id = `swapped-${gc}`;
  select.className = "form-select";
  select.innerHTML = '<option selected disabled value="-1">Select...</option>';

  return select;
};

bcreate = (gc) => {
  const delbtn = document.createElement("button");
  delbtn.id = `delete-${gc}`;
  delbtn.className = "btn btn-outline-danger";
  delbtn.type = "button";
  delbtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

  return delbtn;
};

loadSwaps = async (o, s) => {
  s.innerHTML = '<option selected disabled value="-1">Select...</option>';
  list.data
    .find((item) => item.groupid == o.value)
    .to.forEach(({ id, name }) => {
      s.innerHTML += `<option value="${id}">${name}</option>`;
    });
};

loadPreview = async (o, s) => {
  if (o.value !== -1 && s.value !== -1) {
    const group = list.data.find((x) => x.groupid == o.value);
    if (group) {
      const url = group.to.find((x) => x.id == s.value)?.preview;
      if (url) {
        preview.innerHTML = `<img class="img-fluid" src="${url}">`;
      }
    }
  }
};

validateBeforeBuild = async () => {
  let warn = false; // if there is a warning, don't build
  for (let g of configurator.children) {
    const [o, s] = g.children;
    if (o.value == -1) {
      o.classList.add("is-invalid");
      warn = true;
    }
    if (s.value == -1) {
      s.classList.add("is-invalid");
      warn = true;
    }
  }

  if (langselect.value == -1) {
    langselect.classList.add("is-invalid");
    warn = true;
  }

  if (warn) return;

  for (let g of configurator.children) {
    const [o, s] = g.children;
    o.classList.add("disabled");
    s.classList.add("disabled");
  }

  await buildPatch();
};

getResource = (file) => {
  let type = ishd.checked ? 1 : 0;
  let pathes = [constants.dbcs[type][file], constants.schemas[file]];
  return pathes;
};

readDBCs = async () => {
  const [cdi, cdiSchema] = getResource("CreatureDisplayInfo");
  const [cmd, cmdSchema] = getResource("CreatureModelData");

  const cdiPromise = new Promise((resolve) => {
    const cmiWorker = new Worker("js/worker-read.js");
    cmiWorker.postMessage({ path: cdi, schema: cdiSchema });
    cmiWorker.onmessage = async (e) => {
      resolve(e.data);
    };
  });

  const cmdPromise = new Promise((resolve) => {
    const cmdWorker = new Worker("js/worker-read.js");
    cmdWorker.postMessage({ path: cmd, schema: cmdSchema });
    cmdWorker.onmessage = async (e) => {
      resolve(e.data);
    };
  })

  const [cdiResult, cmdResult] = await Promise.all([
    cdiPromise, cmdPromise
  ])

  dbc["CreatureDisplayInfo"] = cdiResult;
  dbc["CreatureModelData"] = cmdResult;

  temp = dbc;
};

buildPatch = async () => {
  build.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Wait...`;
  build.classList.add("disabled");

  await readDBCs();

  for (let g of configurator.children) {
    const [o, s] = g.children;
    await makeSwap(o, s);
  }

  const cdiPromise = new Promise((resolve) => {
    const cdiWorker = new Worker("js/worker-write.js");
    cdiWorker.postMessage({
      path: temp.CreatureDisplayInfo,
      schema: getResource("CreatureDisplayInfo")[1],
    });
    cdiWorker.addEventListener("message", async (e) => {
      resolve(new Blob([e.data], { type: "application/octet-stream" }));
    });
  });

  const cmdPromise = new Promise((resolve) => {
    const cmdWorker = new Worker("js/worker-write.js");
    cmdWorker.postMessage({
      path: temp.CreatureModelData,
      schema: getResource("CreatureModelData")[1],
    });
    cmdWorker.addEventListener("message", async (e) => {
      resolve(new Blob([e.data], { type: "application/octet-stream" }));
    });
  })

  const [cdiResult, cmdResult] = await Promise.all([
    cdiPromise, cmdPromise
  ])

  let archive = new JSZip();
  archive.folder(`patch-${langselect.value}-x.mpq/DBFilesClient`)
    .file("CreatureDisplayInfo.dbc", cdiResult)
    .file("CreatureModelData.dbc", cmdResult);

  archive.generateAsync({ type: "blob" }).then((content) => {
    build.href = URL.createObjectURL(content);
    build.className = "btn btn-success";
    build.download = `patch-${langselect.value}-x.mpq.zip`;
    build.innerHTML = `<i class="fa-solid fa-download"></i> Download`;
    build.classList.remove("disabled");
  })

  build.removeEventListener("click", validateBeforeBuild);

  temp = {}; // reset temp
};

makeSwap = async (o, s) => {
  const displayinfo = await fetch(
    `swaps/displayinfo/${o.value}/${s.value}.hdc`
  ).then((res) => res.text());
  const modeldata = await fetch(
    `swaps/modeldata/${o.value}/${s.value}.hdc`
  ).then((res) => res.text());
  const displayinfoRows = displayinfo.split("\n").map((row) => row.split(","));
  const modeldataRows = modeldata.split("\n").map((row) => row.split(","));

  for (let i = 1; i < displayinfoRows.length; i++) {
    let record = temp["CreatureDisplayInfo"].find(
      (x) => x[displayinfoRows[0][0]] == displayinfoRows[i][0]
    );
    if (record) {
      Object.assign(
        record,
        displayinfoRows[i].reduce((obj, value, index) => {
          obj[displayinfoRows[0][index]] = value;
          return obj;
        }, {})
      );
    }
  }

  for (let i = 1; i < modeldataRows.length; i++) {
    let record = {};
    modeldataRows[i].forEach((value, index) => {
      record[modeldataRows[0][index]] = value;
    })
    temp["CreatureModelData"].push(record);
  }
  console.log(temp["CreatureModelData"]);
};
