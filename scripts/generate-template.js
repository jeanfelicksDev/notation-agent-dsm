const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

const headers = [
  'Nom',
  'Prénom',
  'Matricule(collaborateurs)\nTéléphone(client externe)',
  'Service',
  'Département\n(Dsm/Manut/Entrepot)',
  'Statut\n[Agent ou Manager]',
  'Direction'
];
const example = [
  ['KONE', 'Moussa', 'MAT-001', 'Logistique', 'Dsm', 'Agent', 'DSM'],
  ['DIALLO', 'Aminata', 'MAT-002', 'Comptabilité', 'Manut', 'Manager', 'DSM'],
  ['SOCIÉTÉ CLIENTE', 'Contact', '0707070707', '', '', 'Client', ''],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);

ws['!cols'] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 30 },
  { wch: 20 },
  { wch: 30 },
  { wch: 25 },
  { wch: 15 },
];

XLSX.utils.book_append_sheet(wb, ws, 'Agents');

const outPath = path.join(__dirname, '..', 'public', 'templates', 'modele-import-agents.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`Modèle créé : ${outPath}`);
