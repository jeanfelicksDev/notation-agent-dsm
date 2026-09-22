const fs = require('fs');

const firstNames = [
  "Jean", "Kouassi", "Awa", "Ibrahim", "Yao", "Fatou", "Moussa", "Aminata", "Koffi", "Adjoua",
  "Sékou", "Mariam", "Konan", "Binta", "Abdoulaye", "Grace", "Bakary", "Oumou", "Sidiki", "Akissi",
  "Emmanuel", "Chantal", "Marc", "Patricia", "Patrick", "Nathalie", "Christian", "Esther", "Serge", "Sylvie",
  "Alain", "Monique", "Franck", "Delphine", "Thierry", "Brigitte", "Didier", "Sandrine", "Fabrice", "Valérie",
  "Gérard", "Isabelle", "Stéphane", "Catherine", "Olivier", "Christine", "Laurent", "Véronique", "Pascal", "Florence",
  "Honoré", "Ahou", "Kouadio", "Affoué", "N'Guessan", "Adama", "Fanta", "Mamadou", "Salimata", "Issouf",
  "Khadija", "Cheick", "Tenin", "Lassina", "Saliou", "Kadiatou", "Drissa", "Rokia", "Amadou", "Djénéba",
  "Hassan", "Aïcha", "Oumar", "Zalissa", "Boubacar", "Kani", "Ali", "Awa", "Souleymane", "Maimouna",
  "Philippe", "Carine", "Arnaud", "Sonia", "Hervé", "Corinne", "Thibaut", "Sophie", "Guillaume", "Julie",
  "Bertrand", "Audrey", "Cédric", "Melanie", "Rodolphe", "Vanessa", "Wilfried", "Jessica", "Lionel", "Clarisse"
];

const lastNames = [
  "KOUASSI", "DIOMANDE", "KONAN", "BAKA", "KOUADIO", "TOURE", "TRAORE", "YAO", "DIABATE", "CAMARA",
  "N'GUESSAN", "KOFFI", "MEITE", "BAMBA", "CISSE", "SANOGO", "KONE", "COULIBALY", "OUATTARA", "DIALLO",
  "SYLLA", "FOFANA", "BARRY", "KEITA", "DABO", "SOW", "BAH", "DIALLO", "KANTE", "MARA",
  "GBANE", "SANGARE", "BERTE", "TIEBI", "DOUBIA", "ZOHOUN", "LOUA", "GOHOU", "BOHUI", "ZOKOU",
  "KPANGNI", "BROU", "N'DRI", "AKA", "ANOH", "EDOUARD", "ASSALE", "TANO", "ESSOIS", "KOUAME",
  "BENSON", "DOSSOU", "MENSAH", "LAWSON", "ADAMS", "JOHNSON", "KOFFI-KOUAKOU", "GNAHORE", "SERY", "ZADI",
  "ZOKO", "BLE", "LAGO", "GORE", "DIGBEU", "ZAMBLE", "VANIÉ", "LOUGBO", "DJEDJE", "TAPÉ",
  "N'DORI", "ADOU", "AMON", "EHOUMAN", "BOHOUSSOU", "YAPO", "SEKA", "ABO", "ATSE", "MOBIO",
  "DANHO", "AGNERO", "LATH", "MEL", "ESSMEL", "N'DRIN", "BLEDOU", "KRAGBE", "DATTE", "KANGOUTE",
  "SIDIBE", "FARMA", "DICKO", "SAWADOGO", "COMPAORE", "OUEDRAOGO", "ZONGO", "KABORE", "NIKIEMA", "TAPSOBA"
];

const services = [
  "Informatique & Systèmes d'Information",
  "Ressources Humaines",
  "Finance & Comptabilité",
  "Exploitation & Logistique",
  "Direction Générale",
  "Commercial & Marketing",
  "Qualité, Hygiène & Sécurité (HSE)",
  "Achats & Approvisionnements",
  "Maintenance & Infrastructure",
  "Service Client & Support"
];

const sites = [
  "Siège Abidjan (Treichville)",
  "Site San-Pédro",
  "Site Bouaké",
  "Site Yamoussoukro"
];

// Managers list (first 10 employees will be managers)
const rows = [];
rows.push("Matricule *;Nom *;Prénom *;Email *;Service / Département;Rôle Système;Affectation Site;Manager Hiérarchique (N+1)");

// Generate 100 users
// First 10 are Managers/Admins
for (let i = 1; i <= 100; i++) {
  const matricule = `DSM-${String(i).padStart(3, '0')}`;
  const nom = lastNames[(i - 1) % lastNames.length];
  const prenom = firstNames[(i - 1) % firstNames.length];
  
  // Clean email prefix
  const cleanPrenom = prenom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const cleanNom = nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const email = `${cleanPrenom}.${cleanNom}${i > 40 ? i : ''}@dsm.ci`;
  
  const service = services[(i - 1) % services.length];
  const site = sites[(i - 1) % sites.length];
  
  let role = "UTILISATEUR";
  let manager = "";

  if (i === 1) {
    role = "ADMIN";
    manager = ""; // Top boss
  } else if (i <= 12) {
    role = "MANAGER";
    manager = "DSM-001"; // Managed by Director/Admin
  } else {
    role = "UTILISATEUR";
    // Assign a manager from DSM-002 to DSM-012 based on service
    const managerIndex = 2 + ((i - 1) % 11);
    manager = `DSM-${String(managerIndex).padStart(3, '0')}`;
  }

  rows.push(`${matricule};${nom};${prenom};${email};${service};${role};${site};${manager}`);
}

fs.writeFileSync('utilisateurs_100_dsm.csv', rows.join('\n'), 'utf8');
console.log('Fichier utilisateurs_100_dsm.csv généré avec succès !');
