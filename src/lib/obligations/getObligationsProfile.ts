import { OBLIGATIONS_CATALOGUE, type FormeJuridiqueCategorie, type RegimeTva, type RegimeFiscal, type Periodicite } from "./catalogue";

export interface CompanyFiscalProfile {
  forme_juridique_categorie: FormeJuridiqueCategorie;
  regime_tva: RegimeTva;
  regime_fiscal: RegimeFiscal;
}

export interface Obligation {
  type: string;
  label: string;
  periodicite: Periodicite;
}

/** Pure : ne lit que le profil fiscal, filtre le catalogue déclaratif. Aucun accès réseau/BDD. */
export function getObligationsProfile(company: CompanyFiscalProfile): Obligation[] {
  return OBLIGATIONS_CATALOGUE
    .filter(rule => {
      const { formeJuridiqueCategorie, regimeTva, regimeFiscal } = rule.appliesTo;
      if (formeJuridiqueCategorie && !formeJuridiqueCategorie.includes(company.forme_juridique_categorie)) return false;
      if (regimeTva && !regimeTva.includes(company.regime_tva)) return false;
      if (regimeFiscal && !regimeFiscal.includes(company.regime_fiscal)) return false;
      return true;
    })
    .map(({ type, label, periodicite }) => ({ type, label, periodicite }));
}
