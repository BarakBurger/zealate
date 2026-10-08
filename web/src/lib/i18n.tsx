import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'he' | 'en';

const he = {
  brand: 'זילייט', tagline: 'כותבים ספרים פרק אחר פרק. קוראים אותם כמו ספר.',
  heroTitle: 'הספר הבא שלך מתחיל בדף אחד',
  heroBody: 'מקום שקט לכתוב בו, בגודל של דף אמיתי. כשתהיו מוכנים, הפכו את הספר לציבורי והקוראים יוכלו לדפדף בו.',
  startWriting: 'להתחיל לכתוב', searchPlaceholder: 'חיפוש ספרים, פרקים וסופרים', search: 'חיפוש',
  publicShelf: 'על המדף', noResults: 'לא נמצאו ספרים. נסו מילה אחרת.', emptyShelf: 'עוד אין ספרים ציבוריים. הראשון יכול להיות שלכם.',
  login: 'כניסה', signup: 'הרשמה', logout: 'יציאה', username: 'שם משתמש', password: 'סיסמה',
  showPassword: 'הצגת סיסמה', hidePassword: 'הסתרת סיסמה',
  noReset: 'אין איפוס סיסמה. שמרו אותה במקום בטוח: סיסמה שנשכחה היא חשבון שאבד.',
  haveAccount: 'כבר יש לכם חשבון?', noAccount: 'עוד אין לכם חשבון?', welcomeBack: 'ברוכים השבים', createAccount: 'פתיחת חשבון',
  usernameHint: '3 עד 24 תווים: אותיות, ספרות, נקודה, מקף או קו תחתון', passwordHint: 'לפחות 8 תווים',
  myDesk: 'השולחן שלי', newBook: 'ספר חדש', untitled: 'ספר ללא שם', newBookTitle: 'איך יקראו לספר?', create: 'יצירה', cancel: 'ביטול',
  deskEmpty: 'השולחן ריק. כל ספר מתחיל בכותרת.', chapters: 'פרקים', chapter: 'פרק', words: 'מילים',
  contents: 'תוכן העניינים', addChapter: 'פרק חדש', noChapters: 'אין עדיין פרקים. הוסיפו את הראשון.',
  write: 'כתיבה', read: 'קריאה', startReading: 'להתחיל לקרוא', continueWriting: 'להמשיך לכתוב',
  public: 'ציבורי', private: 'פרטי', makePublic: 'הספר ציבורי', makePublicHint: 'כל אחד יוכל למצוא ולקרוא אותו',
  showAuthor: 'להציג את שמי', showAuthorHint: 'שם המשתמש שלכם יופיע על הספר ויהיה ניתן לחפש לפיו',
  anonymous: 'סופר/ת אנונימי/ת', by: 'מאת', cover: 'כריכה', uploadCover: 'העלאת כריכה', replaceCover: 'החלפת כריכה', removeCover: 'הסרת כריכה',
  coverHint: 'JPG, PNG או WebP, עד 4MB. יחס 2:3 נראה הכי טוב.',
  description: 'תקציר', descriptionPlaceholder: 'כמה שורות שיגרמו למישהו לפתוח את הספר', title: 'כותרת',
  moveUp: 'להזיז למעלה', moveDown: 'להזיז למטה', deleteChapter: 'מחיקת פרק', deleteBook: 'מחיקת הספר',
  confirmDeleteChapter: 'למחוק את הפרק הזה? אי אפשר לשחזר.', confirmDeleteBook: 'למחוק את כל הספר, כולל כל הפרקים? אי אפשר לשחזר.',
  saving: 'שומר…', saved: 'נשמר', saveFailed: 'לא נשמר. ננסה שוב בעוד רגע.', chapterTitle: 'שם הפרק',
  writeHere: 'כאן מתחיל הפרק…', pageApprox: 'עמוד', ofPages: 'מתוך', prevChapter: 'הפרק הקודם', nextChapter: 'הפרק הבא',
  prevPage: 'הדף הקודם', nextPage: 'הדף הבא', backToBook: 'חזרה לספר', textSize: 'גודל טקסט', theme: 'רקע',
  paper: 'נייר', sepia: 'ספיה', night: 'לילה', endOfBook: 'סוף הספר', endOfChapter: 'סוף הפרק',
  notFound: 'הדף לא נמצא', toHome: 'לעמוד הבית', loading: 'טוען…', language: 'English', error: 'משהו השתבש',
  authorName: 'שם הכותב על הספר', authorNameHint: 'שם אמיתי או שם עט. אם נשאר ריק, יופיע שם המשתמש.',
  listPublic: 'רשימת הפרקים ציבורית', listPublicHint: 'הקוראים יראו את שמות כל הפרקים, גם אלה שעוד לא פורסמו',
  published: 'פורסם', draft: 'טיוטה', publishChapter: 'פרסום הפרק', unpublishChapter: 'החזרה לטיוטה',
  chapterPublishedHint: 'רק פרק שפורסם אפשר לקרוא. פרק חדש מתחיל כטיוטה.', comingSoon: 'בקרוב',
  addAfter: 'הוספת פרק אחרי', addAtStart: 'פרק חדש בהתחלה', page: 'עמוד',
  exportBook: 'ייצוא הספר', exportPdf: 'PDF', exportDoc: 'Word', exportHint: 'כל הפרקים, כולל טיוטות, בגודל עמוד של ספר',
  printNow: 'שמירה כ-PDF', printHint: 'בחלון ההדפסה בחרו "שמירה כ-PDF". גודל העמוד כבר מוגדר לגודל של ספר.',
  focusMode: 'מצב כתיבה שקט', exitFocus: 'יציאה ממצב שקט', share: 'העתקת קישור', copied: 'הקישור הועתק',
};
type Dict = typeof he;
const en: Dict = {
  brand: 'Zealate', tagline: 'Write books chapter by chapter. Read them like books.',
  heroTitle: 'Your next book starts with one page',
  heroBody: 'A quiet place to write, at the size of a real page. When you are ready, make it public and readers can turn its pages.',
  startWriting: 'Start writing', searchPlaceholder: 'Search books, chapters and authors', search: 'Search',
  publicShelf: 'On the shelf', noResults: 'No books found. Try another word.', emptyShelf: 'No public books yet. The first one could be yours.',
  login: 'Sign in', signup: 'Sign up', logout: 'Sign out', username: 'Username', password: 'Password',
  showPassword: 'Show password', hidePassword: 'Hide password',
  noReset: 'There is no password reset. Keep it somewhere safe: a forgotten password is a lost account.',
  haveAccount: 'Already have an account?', noAccount: 'No account yet?', welcomeBack: 'Welcome back', createAccount: 'Create your account',
  usernameHint: '3 to 24 characters: letters, digits, dot, dash or underscore', passwordHint: 'At least 8 characters',
  myDesk: 'My desk', newBook: 'New book', untitled: 'Untitled book', newBookTitle: 'What is the book called?', create: 'Create', cancel: 'Cancel',
  deskEmpty: 'The desk is empty. Every book starts with a title.', chapters: 'Chapters', chapter: 'Chapter', words: 'words',
  contents: 'Contents', addChapter: 'New chapter', noChapters: 'No chapters yet. Add the first one.',
  write: 'Write', read: 'Read', startReading: 'Start reading', continueWriting: 'Keep writing',
  public: 'Public', private: 'Private', makePublic: 'Book is public', makePublicHint: 'Anyone can find and read it',
  showAuthor: 'Show my name', showAuthorHint: 'Your username appears on the book and can be searched',
  anonymous: 'Anonymous author', by: 'by', cover: 'Cover', uploadCover: 'Upload cover', replaceCover: 'Replace cover', removeCover: 'Remove cover',
  coverHint: 'JPG, PNG or WebP, up to 4 MB. A 2:3 ratio looks best.',
  description: 'Blurb', descriptionPlaceholder: 'A few lines that make someone open the book', title: 'Title',
  moveUp: 'Move up', moveDown: 'Move down', deleteChapter: 'Delete chapter', deleteBook: 'Delete book',
  confirmDeleteChapter: 'Delete this chapter? This cannot be undone.', confirmDeleteBook: 'Delete the whole book and every chapter? This cannot be undone.',
  saving: 'Saving…', saved: 'Saved', saveFailed: 'Not saved. Retrying in a moment.', chapterTitle: 'Chapter title',
  writeHere: 'The chapter begins here…', pageApprox: 'Page', ofPages: 'of', prevChapter: 'Previous chapter', nextChapter: 'Next chapter',
  prevPage: 'Previous page', nextPage: 'Next page', backToBook: 'Back to the book', textSize: 'Text size', theme: 'Paper',
  paper: 'Paper', sepia: 'Sepia', night: 'Night', endOfBook: 'The end', endOfChapter: 'End of chapter',
  notFound: 'Page not found', toHome: 'Go home', loading: 'Loading…', language: 'עברית', error: 'Something went wrong',
  authorName: 'Author name on the book', authorNameHint: 'Your real name or a pen name. If empty, your username is shown.',
  listPublic: 'Chapter list is public', listPublicHint: 'Readers see every chapter title, including ones not published yet',
  published: 'Published', draft: 'Draft', publishChapter: 'Publish chapter', unpublishChapter: 'Back to draft',
  chapterPublishedHint: 'Only published chapters can be read. A new chapter starts as a draft.', comingSoon: 'Coming soon',
  addAfter: 'Add a chapter after', addAtStart: 'New chapter at the start', page: 'Page',
  exportBook: 'Export the book', exportPdf: 'PDF', exportDoc: 'Word', exportHint: 'Every chapter, drafts included, at book page size',
  printNow: 'Save as PDF', printHint: 'In the print window choose "Save as PDF". The page size is already set to a book page.',
  focusMode: 'Quiet writing mode', exitFocus: 'Leave quiet mode', share: 'Copy link', copied: 'Link copied',
};

const Ctx = createContext<{ lang: Lang; t: Dict; dir: 'rtl' | 'ltr'; toggle: () => void }>(null!);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => (document.documentElement.lang === 'en' ? 'en' : 'he'));
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    try { localStorage.setItem('z_lang', lang); } catch { /* private mode */ }
  }, [lang]);
  const value = useMemo(() => ({
    lang, t: lang === 'he' ? he : en, dir: (lang === 'he' ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    toggle: () => setLang(l => (l === 'he' ? 'en' : 'he')),
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export const useI18n = () => useContext(Ctx);

/** Direction of a piece of user text, from its first strong character. Empty text follows the UI. */
export const textDir = (s: string, fallback: 'rtl' | 'ltr'): 'rtl' | 'ltr' => {
  const m = s.match(/[A-Za-zÀ-ɏ֐-׿؀-ۿ]/);
  if (!m) return fallback;
  return /[֐-׿؀-ۿ]/.test(m[0]) ? 'rtl' : 'ltr';
};
