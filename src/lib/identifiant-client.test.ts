import { describe, expect, it } from 'vitest'
import {
  emailEstReel,
  emailFictifClient,
  erreurFicheClient,
  identifiantsAcceptes,
  MESSAGE_CLIENT_SANS_IDENTIFIANT,
  typeDeSaisie,
  verifierSaisieClient,
} from '@/lib/identifiant-client'

const client = (telephone: string | null, email: string | null) => ({ telephone, email })

describe('typeDeSaisie', () => {
  it('reconnaît une adresse e-mail', () => {
    expect(typeDeSaisie('  Awa.Kone@exemple.ci ')).toBe('email')
  })

  it('reconnaît un numéro, même avec espaces, tirets ou indicatif', () => {
    expect(typeDeSaisie('07 00 00 00 00')).toBe('telephone')
    expect(typeDeSaisie('+225 07-00-00-00-00')).toBe('telephone')
  })

  it('refuse une saisie trop courte ou mal formée', () => {
    expect(typeDeSaisie('0700')).toBeNull()
    expect(typeDeSaisie('awa@')).toBeNull()
    expect(typeDeSaisie('awa kone')).toBeNull()
    expect(typeDeSaisie('   ')).toBeNull()
  })
})

describe('emailEstReel', () => {
  it('écarte les adresses générées à l’import', () => {
    expect(emailEstReel('a1234@dsm.local')).toBe(false)
    expect(emailEstReel('A1234@DSM.LOCAL')).toBe(false)
    expect(emailEstReel(null)).toBe(false)
    expect(emailEstReel('awa@exemple.ci')).toBe(true)
  })
})

describe('identifiantsAcceptes', () => {
  it('accepte le téléphone quand le client n’a qu’un téléphone', () => {
    expect(identifiantsAcceptes(client('0700000000', null))).toEqual(['telephone'])
  })

  it('accepte l’e-mail quand le client n’a qu’un e-mail réel', () => {
    expect(identifiantsAcceptes(client(null, 'awa@exemple.ci'))).toEqual(['email'])
  })

  it('accepte l’un ou l’autre quand le client a les deux', () => {
    expect(identifiantsAcceptes(client('0700000000', 'awa@exemple.ci'))).toEqual(['telephone', 'email'])
  })

  it('ignore un e-mail fictif et un téléphone vide', () => {
    expect(identifiantsAcceptes(client('  ', 'x@dsm.local'))).toEqual([])
    expect(identifiantsAcceptes(client(null, 'x@dsm.local'))).toEqual([])
  })
})

describe('verifierSaisieClient', () => {
  it('accepte la saisie d’un identifiant enregistré', () => {
    expect(verifierSaisieClient('telephone', client('0700000000', null))).toEqual({ ok: true })
    expect(verifierSaisieClient('email', client(null, 'awa@exemple.ci'))).toEqual({ ok: true })
  })

  it('laisse le client qui a les deux choisir son téléphone ou son e-mail', () => {
    expect(verifierSaisieClient('telephone', client('0700000000', 'awa@exemple.ci'))).toEqual({ ok: true })
    expect(verifierSaisieClient('email', client('0700000000', 'awa@exemple.ci'))).toEqual({ ok: true })
  })

  it('oriente vers le seul identifiant enregistré', () => {
    expect(verifierSaisieClient('email', client('0700000000', 'x@dsm.local'))).toEqual({ ok: false, raison: 'telephone_exige' })
    expect(verifierSaisieClient('telephone', client(null, 'awa@exemple.ci'))).toEqual({ ok: false, raison: 'email_exige' })
  })

  it('refuse un client sans téléphone ni e-mail réel', () => {
    expect(verifierSaisieClient('email', client(null, 'x@dsm.local'))).toEqual({ ok: false, raison: 'aucun_identifiant' })
  })
})

describe('erreurFicheClient', () => {
  const fiche = (entite: string, telephone: string, email: string) => ({ entite, telephone, email })

  it('accepte une entité avec un téléphone seul, un e-mail seul ou les deux', () => {
    expect(erreurFicheClient(fiche('SIVOM', '07 00 00 00 00', ''))).toBeNull()
    expect(erreurFicheClient(fiche('SIVOM', '', 'contact@sivom.ci'))).toBeNull()
    expect(erreurFicheClient(fiche('SIVOM', '0700000000', 'contact@sivom.ci'))).toBeNull()
  })

  it('exige l’entité', () => {
    expect(erreurFicheClient(fiche('   ', '0700000000', ''))).toMatch(/entité/)
  })

  it('exige au moins un téléphone ou un e-mail réel', () => {
    expect(erreurFicheClient(fiche('SIVOM', '', ''))).toBe(MESSAGE_CLIENT_SANS_IDENTIFIANT)
    expect(erreurFicheClient(fiche('SIVOM', ' ', 'x@dsm.local'))).toBe(MESSAGE_CLIENT_SANS_IDENTIFIANT)
  })

  it('refuse un numéro trop court ou un e-mail mal formé', () => {
    expect(erreurFicheClient(fiche('SIVOM', '0700', ''))).toMatch(/chiffres/)
    expect(erreurFicheClient(fiche('SIVOM', '', 'contact@'))).toMatch(/e-mail/)
  })
})

describe('emailFictifClient', () => {
  it('produit une adresse unique qui ne compte pas comme e-mail réel', () => {
    const email = emailFictifClient('CLI-1A2B3C4D')
    expect(email).toBe('cli-1a2b3c4d@dsm.local')
    expect(emailEstReel(email)).toBe(false)
  })
})
