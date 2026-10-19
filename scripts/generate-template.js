const XLSX = require('xlsx');
const path = require('path');

// Format de référence de la liste des agents (ordre RH)
const headers = ['Matricule', 'Nom', 'Prénom', 'Sexe', 'Nationalité', 'Emploi', 'Service', 'Département', 'Direction'];
const example = [
  ['MAT-001', 'KONE', 'Moussa', 'M', 'Ivoirienne', 'Agent de transit', 'Transit', 'Opérations maritimes', 'DSM'],
  ['MAT-002', 'DIALLO', 'Aminata', 'F', 'Ivoirienne', 'Comptable', 'Facturation', 'Finance & Clients', 'DSM'],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
ws['!cols'] = [12, 18, 20, 7, 14, 24, 20, 24, 14].map((wch) => ({ wch }));

const notes = XLSX.utils.aoa_to_sheet([
  ['Consignes'],
  ['Une ligne par agent. Le matricule identifie l’agent : s’il existe déjà, sa fiche est mise à jour, sinon il est créé.'],
  ['Sexe : M ou F.'],
  ['Une cellule vide ne modifie pas la valeur déjà enregistrée.'],
  ['Le rôle (agent / manager) n’est pas modifié par ce fichier : il se gère dans la fiche de l’agent.'],
  ['Les agents absents du fichier ne sont ni modifiés ni supprimés.'],
]);
notes['!cols'] = [{ wch: 110 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Agents');
XLSX.utils.book_append_sheet(wb, notes, 'Consignes');

const outPath = path.join(__dirname, '..', 'public', 'templates', 'modele-import-agents.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Modèle créé :', outPath);
