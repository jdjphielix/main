// Centrale toegangsmatrix
export const ROLE_PERMISSIONS = {
  '/dashboard':        ['admin_pay','admin_trade','sales','backoffice','finance','extern','accountmanager'],
  '/leads':            ['admin_pay','admin_trade','sales','extern'],
  '/prospects':        ['admin_pay','admin_trade','sales','extern','accountmanager'],
  '/onboarding':       ['admin_pay','admin_trade','backoffice','accountmanager','sales','extern'],
  '/clients':          ['admin_pay','admin_trade','accountmanager'],
  '/sales-clients':    ['admin_pay','admin_trade','sales','extern'],
  '/chat':             ['admin_pay','admin_trade','sales','backoffice','finance','extern','accountmanager'],
  '/tickets':          ['admin_pay','admin_trade','sales','backoffice','finance','extern','accountmanager'],
  '/sales-dashboard':  ['admin_pay','admin_trade','sales'],
  '/team-management':  ['admin_pay','admin_trade'],
  '/team-onboarding':  ['admin_pay','admin_trade'],
  '/admin':            ['admin_pay','admin_trade'],
  '/tekst-instructie': ['admin_pay','admin_trade'],
  '/limit-orders':     ['admin_pay','admin_trade'],
  '/notifications':    ['admin_pay','admin_trade','sales','backoffice','finance','extern','accountmanager'],
  '/profile':          ['admin_pay','admin_trade','sales','backoffice','finance','extern','accountmanager'],
};

export const TEAMLEADER_EXTRA = ['/team-management','/team-onboarding','/tekst-instructie','/limit-orders','/sales-dashboard','/prospects','/onboarding','/clients'];

export function hasAccess(user, path) {
  if (!user) return false;
  const role = user.role;
  const isTeamleader = user.is_teamleader;
  const allowed = ROLE_PERMISSIONS[path] || [];
  if (isTeamleader && TEAMLEADER_EXTRA.includes(path)) return true;
  return allowed.includes(role) || (isTeamleader && allowed.includes('sales'));
}
