// Blizzard MPQ Archive on JS

const locales = {
    def: 0, // neutral
    zhCN: 0x404, // Chinese
    csCZ: 0x405, // Czech
    deDE: 0x407, // German
    enUS: 0x409, // English
    esES: 0x40a, // Spanish
    frFR: 0x40c, // French
    itIT: 0x410, // Italian
    jaJA: 0x411, // Japanese
    koKR: 0x412, // Korean
    nlNL: 0x413, // Dutch
    plPL: 0x415, // Polish
    ptPT: 0x416, // Portuguese
    ruRU: 0x419, // Russian
    enUK: 0x809 // English (UK)
}

class MPQ {
    constructor() {
        
    }

    createArchive = async (fileslist, language = locales.def) => {
        switch (fileslist.type) {
            case 'string':
                return await fetch(fileslist.path).then(res => res.arrayBuffer());
            case 'object':

                break;
            default:
                throw new Error(`Invalid type: ${data.type}`);
        }
    }
}