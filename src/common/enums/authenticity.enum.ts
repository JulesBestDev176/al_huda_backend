export enum AuthenticityGrade {
  SAHIH = 'sahih',         // صحيح — authentique
  HASAN = 'hasan',         // حسن — bon
  DAIF = 'daif',           // ضعيف — faible
  MAWDU = 'mawdu',         // موضوع — forgé/inventé
  SAHIH_HASAN = 'sahih_hasan',  // صحيح حسن
  UNKNOWN = 'unknown',
}

export const AUTHENTICITY_SCORE: Record<AuthenticityGrade, number> = {
  [AuthenticityGrade.SAHIH]: 1.0,
  [AuthenticityGrade.SAHIH_HASAN]: 0.95,
  [AuthenticityGrade.HASAN]: 0.85,
  [AuthenticityGrade.DAIF]: 0.4,
  [AuthenticityGrade.MAWDU]: 0.0,
  [AuthenticityGrade.UNKNOWN]: 0.6,
};

// Mots-clés arabes pour détecter le grade depuis le texte du site
export const GRADE_KEYWORDS: Record<string, AuthenticityGrade> = {
  'صحيح على شرط الشيخين': AuthenticityGrade.SAHIH,
  'صحيح على شرط البخاري': AuthenticityGrade.SAHIH,
  'صحيح على شرط مسلم': AuthenticityGrade.SAHIH,
  'إسناده صحيح': AuthenticityGrade.SAHIH,
  'صحيح الإسناد': AuthenticityGrade.SAHIH,
  'صحيح': AuthenticityGrade.SAHIH,
  'حسن صحيح': AuthenticityGrade.SAHIH_HASAN,
  'صحيح حسن': AuthenticityGrade.SAHIH_HASAN,
  'إسناده حسن': AuthenticityGrade.HASAN,
  'حسن الإسناد': AuthenticityGrade.HASAN,
  'حسن': AuthenticityGrade.HASAN,
  'ضعيف': AuthenticityGrade.DAIF,
  'إسناده ضعيف': AuthenticityGrade.DAIF,
  'ضعيف الإسناد': AuthenticityGrade.DAIF,
  'موضوع': AuthenticityGrade.MAWDU,
  'مكذوب': AuthenticityGrade.MAWDU,
};

// Mots-clés français pour détecter le grade
export const GRADE_KEYWORDS_FR: Record<string, AuthenticityGrade> = {
  'authentique': AuthenticityGrade.SAHIH,
  'sahih': AuthenticityGrade.SAHIH,
  'hasan': AuthenticityGrade.HASAN,
  'bon': AuthenticityGrade.HASAN,
  'faible': AuthenticityGrade.DAIF,
  'daif': AuthenticityGrade.DAIF,
  'da\'if': AuthenticityGrade.DAIF,
  'inventé': AuthenticityGrade.MAWDU,
  'forgé': AuthenticityGrade.MAWDU,
};
