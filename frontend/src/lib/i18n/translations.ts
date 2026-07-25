export type Language = 'en' | 'tl' | 'ceb'

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ceb', label: 'Bisaya (Cebuano)' },
]

const en = {
  // Sidebar — nav group labels
  'nav.group.overview': 'Overview',
  'nav.group.residents': 'Residents',
  'nav.group.documents': 'Documents',
  'nav.group.finance': 'Finance',
  'nav.group.records': 'Records',
  'nav.group.planning': 'Planning',
  'nav.group.administration': 'Administration',
  'nav.group.platform': 'Platform',

  // Sidebar — nav item labels
  'nav.item.dashboard': 'Dashboard',
  'nav.item.visitorLog': 'Visitor Log',
  'nav.item.reportsDashboard': 'Reports Dashboard',
  'nav.item.residentProfiles': 'Resident Profiles',
  'nav.item.households': 'Households',
  'nav.item.deceasedRecords': 'Deceased Records',
  'nav.item.documentQueue': 'Document Queue',
  'nav.item.documentRelease': 'Document Release',
  'nav.item.budgetOverview': 'Budget Overview',
  'nav.item.appropriations': 'Appropriations',
  'nav.item.revenueTracking': 'Revenue Tracking',
  'nav.item.fundSources': 'Fund Sources',
  'nav.item.disbursements': 'Disbursements',
  'nav.item.financeAudit': 'Finance Audit',
  'nav.item.blotterRecords': 'Blotter Records',
  'nav.item.calendar': 'Calendar',
  'nav.item.agendaMinutes': 'Agenda & Minutes',
  'nav.item.assets': 'Assets',
  'nav.item.auditLogs': 'Audit Logs',
  'nav.item.systemSettings': 'System Settings',
  'nav.item.onboardBarangays': 'Onboard Barangays',

  // Sidebar chrome
  'sidebar.installApp': 'Install App',
  'sidebar.logout': 'Log out',
  'sidebar.collapse': 'Collapse to icons',
  'sidebar.expand': 'Expand sidebar',
  'sidebar.logoutConfirmTitle': 'Log out?',
  'sidebar.logoutConfirmBody': "You'll need to sign in again to access your barangay's records.",
  'sidebar.logoutConfirmAction': 'Log out',

  // Settings — language section
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the language used across the dashboard menu and sign-in screen.',

  // Login page
  'login.tagline': 'An Enterprise-Grade Barangay Operating System',
  'login.greeting.morning': 'Good Morning',
  'login.greeting.afternoon': 'Good Afternoon',
  'login.greeting.evening': 'Good Evening',
  'login.signIn': 'Login',
  'login.signingIn': 'Signing in...',
  'login.signInWithPasskey': 'Sign in with a passkey',
  'login.emailPlaceholder': 'Email address',
  'login.passwordPlaceholder': 'Password',

  // Common actions
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.search': 'Search',
} as const

export type TranslationKey = keyof typeof en

const tl: Record<TranslationKey, string> = {
  'nav.group.overview': 'Buod',
  'nav.group.residents': 'Mga Residente',
  'nav.group.documents': 'Mga Dokumento',
  'nav.group.finance': 'Pananalapi',
  'nav.group.records': 'Mga Talaan',
  'nav.group.planning': 'Pagpaplano',
  'nav.group.administration': 'Pangangasiwa',
  'nav.group.platform': 'Plataporma',

  'nav.item.dashboard': 'Dashboard',
  'nav.item.visitorLog': 'Talaan ng Bisita',
  'nav.item.reportsDashboard': 'Dashboard ng mga Ulat',
  'nav.item.residentProfiles': 'Profile ng mga Residente',
  'nav.item.households': 'Sambahayan',
  'nav.item.deceasedRecords': 'Talaan ng mga Yumao',
  'nav.item.documentQueue': 'Pila ng Dokumento',
  'nav.item.documentRelease': 'Pagpapalabas ng Dokumento',
  'nav.item.budgetOverview': 'Buod ng Badyet',
  'nav.item.appropriations': 'Apropriyasyon',
  'nav.item.revenueTracking': 'Pagsubaybay sa Kita',
  'nav.item.fundSources': 'Pinagmumulan ng Pondo',
  'nav.item.disbursements': 'Pagbabayad',
  'nav.item.financeAudit': 'Awdit ng Pananalapi',
  'nav.item.blotterRecords': 'Talaan ng Blotter',
  'nav.item.calendar': 'Kalendaryo',
  'nav.item.agendaMinutes': 'Agenda at Minuto',
  'nav.item.assets': 'Ari-arian',
  'nav.item.auditLogs': 'Talaan ng Awdit',
  'nav.item.systemSettings': 'Mga Setting ng Sistema',
  'nav.item.onboardBarangays': 'Magdagdag ng Barangay',

  'sidebar.installApp': 'I-install ang App',
  'sidebar.logout': 'Mag-log out',
  'sidebar.collapse': 'I-collapse sa mga icon',
  'sidebar.expand': 'Palawakin ang sidebar',
  'sidebar.logoutConfirmTitle': 'Mag-log out?',
  'sidebar.logoutConfirmBody': 'Kakailanganin mong mag-login muli para ma-access ang mga talaan ng iyong barangay.',
  'sidebar.logoutConfirmAction': 'Mag-log out',

  'settings.language.title': 'Wika',
  'settings.language.description': 'Piliin ang wikang gagamitin sa menu ng dashboard at sa login screen.',

  'login.tagline': 'Isang Antas-Enterprise na Sistema ng Operasyon ng Barangay',
  'login.greeting.morning': 'Magandang Umaga',
  'login.greeting.afternoon': 'Magandang Hapon',
  'login.greeting.evening': 'Magandang Gabi',
  'login.signIn': 'Mag-login',
  'login.signingIn': 'Nagla-login...',
  'login.signInWithPasskey': 'Mag-sign in gamit ang passkey',
  'login.emailPlaceholder': 'Email address',
  'login.passwordPlaceholder': 'Password',

  'common.save': 'I-save',
  'common.cancel': 'Kanselahin',
  'common.search': 'Maghanap',
}

const ceb: Record<TranslationKey, string> = {
  'nav.group.overview': 'Kinatibuk-an',
  'nav.group.residents': 'Mga Residente',
  'nav.group.documents': 'Mga Dokumento',
  'nav.group.finance': 'Panalapi',
  'nav.group.records': 'Mga Talaan',
  'nav.group.planning': 'Pagplano',
  'nav.group.administration': 'Pagdumala',
  'nav.group.platform': 'Plataporma',

  'nav.item.dashboard': 'Dashboard',
  'nav.item.visitorLog': 'Talaan sa Bisita',
  'nav.item.reportsDashboard': 'Dashboard sa mga Taho',
  'nav.item.residentProfiles': 'Profile sa mga Residente',
  'nav.item.households': 'Panimalay',
  'nav.item.deceasedRecords': 'Talaan sa mga Namatay',
  'nav.item.documentQueue': 'Pila sa Dokumento',
  'nav.item.documentRelease': 'Pagpagawas sa Dokumento',
  'nav.item.budgetOverview': 'Kinatibuk-an sa Badyet',
  'nav.item.appropriations': 'Apropriyasyon',
  'nav.item.revenueTracking': 'Pagsubay sa Kita',
  'nav.item.fundSources': 'Gigikanan sa Pondo',
  'nav.item.disbursements': 'Pagbayad',
  'nav.item.financeAudit': 'Awdit sa Panalapi',
  'nav.item.blotterRecords': 'Talaan sa Blotter',
  'nav.item.calendar': 'Kalendaryo',
  'nav.item.agendaMinutes': 'Agenda ug Minuto',
  'nav.item.assets': 'Kabtangan',
  'nav.item.auditLogs': 'Talaan sa Awdit',
  'nav.item.systemSettings': 'Mga Setting sa Sistema',
  'nav.item.onboardBarangays': 'Pagdugang og Barangay',

  'sidebar.installApp': 'I-install ang App',
  'sidebar.logout': 'Mag-log out',
  'sidebar.collapse': 'I-collapse ngadto sa mga icon',
  'sidebar.expand': 'Palapdon ang sidebar',
  'sidebar.logoutConfirmTitle': 'Mag-log out?',
  'sidebar.logoutConfirmBody': 'Kinahanglan nimong mag-login pag-usab aron ma-access ang mga talaan sa imong barangay.',
  'sidebar.logoutConfirmAction': 'Mag-log out',

  'settings.language.title': 'Pinulongan',
  'settings.language.description': 'Pilia ang pinulongan nga gamiton sa menu sa dashboard ug sa login screen.',

  'login.tagline': 'Usa ka Enterprise-Grade nga Sistema sa Operasyon sa Barangay',
  'login.greeting.morning': 'Maayong Buntag',
  'login.greeting.afternoon': 'Maayong Hapon',
  'login.greeting.evening': 'Maayong Gabii',
  'login.signIn': 'Pag-login',
  'login.signingIn': 'Nag-login...',
  'login.signInWithPasskey': 'Pag-sign in gamit ang passkey',
  'login.emailPlaceholder': 'Email address',
  'login.passwordPlaceholder': 'Password',

  'common.save': 'I-save',
  'common.cancel': 'Kanselahon',
  'common.search': 'Pangita',
}

export const translations: Record<Language, Record<TranslationKey, string>> = { en, tl, ceb }
