const fs = require('fs');
const yaml = require('js-yaml');

const mappingTask = JSON.parse(fs.readFileSync('.tract/mapping-task.json', 'utf8'));
const componentsFile = '.tract/components.yaml';
const componentsData = yaml.load(fs.readFileSync(componentsFile, 'utf8'));

function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// Build directory lookup
const dirMap = new Map();
mappingTask.directories.forEach(d => {
  const basename = d.path.split('/').pop();
  const norm = normalize(basename);
  if (!dirMap.has(norm)) dirMap.set(norm, []);
  dirMap.get(norm).push(d.path);
});

// Map components with exact matches
let mapped = 0;
Object.keys(componentsData.components).forEach(compName => {
  const comp = componentsData.components[compName];
  const norm = normalize(compName);
  
  if (dirMap.has(norm)) {
    const matches = dirMap.get(norm);
    // Only take top-level dirs (not metadata subdirs)
    const goodMatches = matches.filter(p => !p.includes('.metadata'));
    if (goodMatches.length > 0 && goodMatches.length < 10) {
      comp.paths = goodMatches;
      mapped++;
    }
  }
});

fs.writeFileSync(componentsFile, yaml.dump(componentsData, {lineWidth: -1, noRefs: true}));
console.log(`✅ Mapped ${mapped} components with exact matches`);
console.log(`📝 ${Object.keys(componentsData.components).length - mapped} components need manual/LLM mapping`);
