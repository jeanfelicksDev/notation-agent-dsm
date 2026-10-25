// Met à jour l'e-mail des agents à partir de la liste matricule -> e-mail fournie par la DSM.
// Usage :
//   node scripts/maj_emails_agents.js            -> simulation (lecture seule), affiche le rapport
//   node scripts/maj_emails_agents.js --apply    -> écrit les changements en base
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envFiles = ['.env.local', '.env.production', '.env']
  for (const file of envFiles) {
    const filePath = path.join(__dirname, '..', file)
    if (!fs.existsSync(filePath)) continue
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    })
  }
}

const LISTE = `
6259 acafou-francis.aboa@aglgroup.com
3562 patricia.ahouro@aglgroup.com
7674 boni-elysee.aka@aglgroup.com
3533 laurent.amani@aglgroup.com
3561 maxime.amien@aglgroup.com
8036 armel.armstrong@aglgroup.com
7690 koffi.ane@aglgroup.com
7624 vanessa.assa@aglgroup.com
3311 katche.ayerebi@aglgroup.com
6261 celestin.bah@aglgroup.com
4123 mohamed.bakayoko@aglgroup.com
7174 hermann.batieno@aglgroup.com
6068 massihoudi.bayaki@aglgroup.com
5112 natacha.bile@aglgroup.com
7175 evariste.bodo@aglgroup.com
7804 stanislas.bonifon@aglgroup.com
7536 krou-alphonse.brou@aglgroup.com
5868 soungalo.koulibaly@aglgroup.com
7058 foungnigue-simone.coulibaly@aglgroup.com
7303 awa-gnon.coulibaly@aglgroup.com
7802 dofara-maxime.coulibaly@aglgroup.com
8250 drissa.diakite@aglgroup.com
7630 amara.diane@aglgroup.com
7353 moussa.diomande@aglgroup.com
7176 ncho-jacques.djechou@aglgroup.com
5688 philibert.dogou@aglgroup.com
4387 dogad.dogoui@aglgroup.com
2888 doko.dosso@aglgroup.com
7675 karamoko.doumbia@aglgroup.com
8150 sandie.faye@aglgroup.com
2820 herve.frean@aglgroup.com
4456 herve.gbalou@aglgroup.com
3325 stephane.gohoun@aglgroup.com
3224 gagnon-serge.ikpo@aglgroup.com
5809 serge.kadjo@aglgroup.com
6067 claude.kassi@aglgroup.com
7527 kouame-paul.konan@aglgroup.com
7571 minata.konate@aglgroup.com
4216 ibrahima-faceli.kone@aglgroup.com
7657 salimata.kone2@aglgroup.com
7304 aminata.kone@aglgroup.com
7713 emmanuel.koua@aglgroup.com
6042 guy-serge.kouakou@aglgroup.com
6466 kouassi.kouame@aglgroup.com
8244 armand.kouame@aglgroup.com
8243 yves.kouame@aglgroup.com
6069 mathias.kouame@aglgroup.com
6616 franck.appia@aglgroup.com
2604 serge-privat.kouassi@aglgroup.com
7063 modeste-kouakou.kouassi@aglgroup.com
8256 adama.kouyate@aglgroup.com
6880 emma-christelle.kpangny@aglgroup.com
6264 edouard.lagui@aglgroup.com
7178 celestin.mahan@aglgroup.com
4184 abder.malle@aglgroup.com
5774 mamadou.coulibaly3@aglgroup.com
8258 mohamed.mariko@aglgroup.com
7582 famien-serge.motche@aglgroup.com
7321 koua-christian.nda@aglgroup.com
7584 marie-claude.nanou@aglgroup.com
5926 bah-laure.nanti@aglgroup.com
4292 eba-constance.niamkey@aglgroup.com
5108 jean-louis.onagnelin@aglgroup.com>
7295 pekaly-augustin.ouattara@aglgroup.com
7803 d.ouattara@aglgroup.com
6929 ismaelykire.palenfo@aglgroup.com
3637 tene.solama-coulibaly@aglgroup.com
6766 sadio.soro@aglgroup.com
6884 mohamed.soumahoro@aglgroup.com
6546 kassoum.toe@aglgroup.com
7470 genevieve.tognissou@aglgroup.com
7671 linda.toili@aglgroup.com
7182 moussa1.traore@aglgroup.com
7573 eric.ya@aglgroup.com
7452 jean-constant.yedoh@aglgroup.com
7494 ruth-davila.yenon@aglgroup.com
6507 awa.zabda@aglgroup.com
7453 jean-felix.ziagoue@aglgroup.com
6267 christophe.natoh@aglgroup.com
8110 franck.alex@aglgroup.com
`

const FORMAT_EMAIL = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/

// Nettoie les scories de copier-coller (chevrons, espaces) et met en minuscules.
function lireListe() {
  return LISTE.trim().split('\n').map((ligne) => {
    const [matricule, brut] = ligne.trim().split(/\s+/)
    return { matricule, email: brut.replace(/[<>]/g, '').toLowerCase() }
  })
}

function controlerListe(lignes) {
  const erreurs = []
  const vus = new Map()
  for (const { matricule, email } of lignes) {
    if (!FORMAT_EMAIL.test(email)) erreurs.push(`format invalide : ${matricule} ${email}`)
    for (const [cle, val] of [['m:' + matricule, email], ['e:' + email, matricule]]) {
      if (vus.has(cle)) erreurs.push(`doublon dans la liste : ${cle.slice(2)} (${vus.get(cle)} / ${val})`)
      vus.set(cle, val)
    }
  }
  return erreurs
}

async function main() {
  loadEnv()
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL non trouvée')
  const apply = process.argv.includes('--apply')
  const lignes = lireListe()
  const erreursListe = controlerListe(lignes)
  if (erreursListe.length) throw new Error(erreursListe.join('\n'))

  const c = new Client({ connectionString: process.env.DATABASE_URL })
  await c.connect()
  try {
    const { rows } = await c.query('select id, matricule, nom, prenom, role, email from "Utilisateur"')
    const parMatricule = new Map(rows.map((u) => [u.matricule, u]))
    const parEmail = new Map(rows.map((u) => [u.email.toLowerCase(), u]))

    const introuvables = lignes.filter((l) => !parMatricule.has(l.matricule))
    const presents = lignes.filter((l) => parMatricule.has(l.matricule))
    const aChanger = presents.filter((l) => parMatricule.get(l.matricule).email.toLowerCase() !== l.email)
    // Un e-mail déjà porté par un AUTRE compte qui ne fait pas partie de la liste bloquerait l'unicité.
    const matriculesListe = new Set(lignes.map((l) => l.matricule))
    const conflits = aChanger.filter((l) => {
      const porteur = parEmail.get(l.email)
      return porteur && porteur.matricule !== l.matricule && !matriculesListe.has(porteur.matricule)
    })

    console.log(`\n=== À modifier (${aChanger.length} sur ${presents.length} trouvés) ===`)
    aChanger.forEach((l) => {
      const u = parMatricule.get(l.matricule)
      console.log(`  ${l.matricule} ${u.nom} ${u.prenom} [${u.role}]\n      ${u.email}  =>  ${l.email}`)
    })
    console.log(`\n=== Matricules introuvables (${introuvables.length}) ===`)
    introuvables.forEach((l) => console.log(`  ${l.matricule} ${l.email}`))
    console.log(`\n=== Conflits d'unicité (${conflits.length}) ===`)
    conflits.forEach((l) => console.log(`  ${l.matricule} ${l.email} déjà utilisé par ${parEmail.get(l.email).matricule}`))
    const nonCites = rows.filter((u) => !matriculesListe.has(u.matricule))
    console.log(`\n=== En base mais absents de la liste, inchangés (${nonCites.length}) ===`)
    nonCites.forEach((u) => console.log(`  ${u.matricule} ${u.nom} ${u.prenom} [${u.role}] ${u.email}`))

    if (!apply) {
      console.log('\nSimulation uniquement : relancer avec --apply pour écrire en base.')
      return
    }
    if (conflits.length) throw new Error('conflits d\'unicité : rien n\'a été écrit')
    await c.query('begin')
    try {
      // Passage par un e-mail temporaire : évite les collisions si deux agents échangent leurs adresses.
      for (const l of aChanger) {
        await c.query('update "Utilisateur" set email = $1 where matricule = $2', [`tmp-${l.matricule}@maj.local`, l.matricule])
      }
      for (const l of aChanger) {
        await c.query('update "Utilisateur" set email = $1, "updatedAt" = now() where matricule = $2', [l.email, l.matricule])
      }
      await c.query('commit')
    } catch (e) {
      await c.query('rollback')
      throw e
    }
    console.log(`\n${aChanger.length} e-mail(s) mis à jour.`)
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error('Erreur :', e.message || e)
  process.exit(1)
})
