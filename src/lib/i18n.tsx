import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, type I18n } from './i18nContext'

const en = {
  appName: 'DPDC Bill Check',
  tagline: 'Check your DPDC postpaid bill in seconds',
  unofficial: 'Unofficial helper',
  skip: 'Skip to bill check',

  // header
  signIn: 'Sign in',
  signOut: 'Sign out',
  language: 'বাংলা',
  languageLabel: 'Switch to Bangla',
  themeLight: 'Light theme',
  themeDark: 'Dark theme',
  themeSystem: 'Use system theme',
  accountMenu: 'Account menu',
  syncedAs: 'Synced as {name}',
  deviceOnly: 'Saved on this device',
  deleteCloudData: 'Delete my saved data',
  deleteCloudConfirm: 'Delete all saved numbers and history from your account? This cannot be undone.',
  cloudDeleted: 'Your saved data was deleted',

  // check form
  checkTitle: 'Check a bill',
  customerNo: 'Customer number',
  customerNoHint: 'Printed on your bill, usually 8 digits. Bangla digits work too.',
  customerNoPlaceholder: 'e.g. 12345678',
  errEmpty: 'Enter your customer number',
  errNotDigits: 'Use digits only',
  errLength: 'Customer numbers are {min}–{max} digits',
  savedAccounts: 'Saved numbers',
  otherNumber: 'Another number',
  saveThisNumber: 'Save this number for next time',
  saveAs: 'Save as',
  nickname: 'Nickname',
  nicknamePlaceholder: 'e.g. Home, Shop, Mother’s flat',
  billType: 'Bill type',
  bt_current: 'E-bill',
  bt_current_desc: 'The bill for the selected month, with amount and due date.',
  bt_summary: 'Ledger',
  bt_summary_desc: 'Billing and payment history for the account.',
  bt_misc: 'Misc bill',
  bt_misc_desc: 'Other charges such as reconnection or meter fees.',
  billMonth: 'Bill month',
  month: 'Month',
  year: 'Year',
  futureMonth: 'The {month} bill is generated after the 7th of {next}, so it may not exist yet.',
  latestBillChip: 'Latest · {month}',
  moreOptions: 'More options',
  emailCopy: 'E-mail a copy (optional)',
  emailHint: 'DPDC can e-mail the bill to this address. We remember it for next time.',
  errEmail: 'That e-mail doesn’t look right',
  checkButton: 'Check bill on DPDC',
  copyLink: 'Copy link',
  share: 'Share',
  linkCopied: 'Link copied',
  copyFailed: 'Couldn’t copy. Long-press the link instead.',
  openedTitle: 'DPDC opened in a new tab',
  openedTitlePopup: 'DPDC opened in a window',
  openAgainWindow: 'Bring the DPDC window back',
  openedBody: 'Everything is filled in. Type the 5-character security code shown on that page and press the search button.',
  popupBlocked: 'Your browser blocked the new tab.',
  openManually: 'Open DPDC bill page',
  numberSaved: 'Saved “{name}”',

  // how it works
  whyCaptcha:
    'DPDC protects bills with a security code, so the bill opens on the official site. We never see your bill.',

  // accounts
  accountsTitle: 'Saved numbers',
  addNumber: 'Add number',
  noAccounts: 'No saved numbers yet. Save one and it will be filled in automatically next time.',
  default: 'Default',
  makeDefault: 'Make default',
  edit: 'Edit',
  delete: 'Delete',
  check: 'Check',
  deleteConfirm: 'Remove “{name}” from saved numbers?',
  removed: 'Removed “{name}”',
  undo: 'Undo',
  addTitle: 'Add a customer number',
  editTitle: 'Edit saved number',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  duplicate: 'This number is already saved as “{name}”',
  untitled: 'Account {no}',

  // history
  historyTitle: 'Recent checks',
  noHistory: 'Bills you check will appear here so you can open them again in one tap.',
  clearHistory: 'Clear',
  clearHistoryConfirm: 'Clear recent checks?',
  openAgain: 'Open again',

  // reminder
  reminderTitle: 'Monthly reminder',
  reminderBody: 'Add a repeating reminder to your phone or computer calendar. New bills are ready after the 7th of each month.',
  reminderDay: 'Remind me on day',
  reminderButton: 'Add to calendar',
  reminderEventTitle: 'Check DPDC electricity bill',
  reminderEventBody: 'Open DPDC Bill Check to see this month’s bill.',
  reminderDownloaded: 'Calendar file downloaded. Open it to add the reminder.',

  // sign-in banner
  syncBannerTitle: 'Keep your numbers on every device',
  syncBannerBody: 'Sign in to sync saved numbers and recent checks to your phone and computer.',

  // auth dialog
  authTitle: 'Sign in to sync',
  authSubtitle: 'Your saved numbers follow you to every device. Numbers already saved here are kept.',
  continueGoogle: 'Continue with Google',
  or: 'or',
  email: 'E-mail',
  password: 'Password',
  name: 'Your name (optional)',
  signInButton: 'Sign in',
  createAccount: 'Create account',
  createAccountButton: 'Create account',
  haveAccount: 'Already have an account?',
  noAccount: 'New here?',
  forgotPassword: 'Forgot password?',
  sendReset: 'Send reset link',
  backToSignIn: 'Back to sign in',
  resetTitle: 'Reset your password',
  resetSent: 'Check your inbox for a password reset link.',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  passwordHint: 'At least 6 characters',
  signedIn: 'Signed in. Your numbers will sync.',
  signedOut: 'Signed out',
  imported: 'Added {count} number(s) from this device to your account',
  syncError: 'Couldn’t sync. Changes will be retried when you’re back online.',
  authUnavailable: 'Sign-in isn’t set up on this site yet. Your numbers are saved on this device.',
  ae_invalid: 'Wrong e-mail or password',
  ae_inUse: 'An account with this e-mail already exists. Try signing in.',
  ae_weak: 'Choose a password with at least 6 characters',
  ae_email: 'Enter a valid e-mail address',
  ae_tooMany: 'Too many attempts. Please wait a moment and try again.',
  ae_network: 'No connection. Check your internet and try again.',
  ae_generic: 'Something went wrong. Please try again.',

  // bill history
  billsTitle: 'Bill history',
  uploadBills: 'Upload bill PDF',
  addManually: 'Add manually',
  billsEmpty: 'Upload the bill PDFs you download from DPDC. The app reads them on this device and saves a summary for each month: amount, units and due date.',
  billsPrivacy: 'PDFs are read on your device and never uploaded. Only the summary is saved.',
  dropHere: 'Drop bill PDFs here',
  latestBill: 'Latest bill',
  average: '{n}-month average',
  highest: 'Highest',
  amount: 'Amount (৳)',
  lateAmount: 'After due date (৳)',
  lateAmountShort: 'After due',
  presentReading: 'Present reading',
  previousReading: 'Previous reading',
  meterReading: 'Meter reading',
  units: 'Units (kWh)',
  dueDate: 'Due date',
  noDueDate: '—',
  billChartLabel: 'Bill amount by month',
  editBill: 'Edit bill',
  deleteBill: 'Delete bill',
  billDeleted: 'Deleted the {month} bill',
  status: 'Status',
  paid: 'Paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
  markPaid: 'Mark as paid',
  markUnpaid: 'Mark as unpaid',
  editPayment: 'Change payment',
  paidOn: 'Paid on',
  paidLockedNote: 'A paid bill is locked. Mark it unpaid if you need to edit or delete it.',
  billMarkedPaid: 'Marked the {month} bill as paid',
  billMarkedUnpaid: 'Marked the {month} bill as unpaid',
  unpaidSummary: '{count} unpaid bill(s) · {amount}',
  billPaidLocked: 'The {month} bill is marked paid and can’t be replaced. Pick another month or skip this one.',
  billsSaved: 'Saved {count} bill(s)',
  billReplaced: 'Replaces the saved {month} bill',
  importTitle: 'Check the bill details',
  importSubtitle: 'Read from your PDF. Fix anything that’s wrong, then save.',
  manualTitle: 'Add a bill',
  reading: 'Reading {name}…',
  notFound: 'Not found in the PDF — please fill in',
  warnNoText: 'This PDF has no readable text (it may be a scan or photo). Please fill in the fields.',
  warnBangla: 'This PDF uses an old Bangla font the app can’t read. Some numbers may still be found — please check every field.',
  errTooBig: 'This file is larger than 10 MB.',
  errNotPdf: 'This file isn’t a PDF.',
  errProtected: 'This PDF is password protected.',
  errBroken: 'This PDF couldn’t be opened.',
  errAmount: 'Enter the bill amount',
  errMonth: 'Choose the bill month',
  skipFile: 'Skip',
  saveBills: 'Save {count} bill(s)',
  willAddNumber: 'This number will be added to your saved numbers.',

  // footer
  footerDisclaimer:
    'Not affiliated with DPDC. Bills are shown only on the official site, dpdc.org.bd. Saved numbers stay on this device unless you sign in.',
  officialSite: 'Official DPDC website',
  offline: 'You’re offline. Saved numbers still work, but DPDC needs internet.',
  justNow: 'just now',
}

export type MessageKey = keyof typeof en

const bn: Record<MessageKey, string> = {
  appName: 'ডিপিডিসি বিল চেক',
  tagline: 'সেকেন্ডেই ডিপিডিসি পোস্টপেইড বিল দেখুন',
  unofficial: 'অনানুষ্ঠানিক সহায়ক',
  skip: 'বিল চেকে যান',

  signIn: 'সাইন ইন',
  signOut: 'সাইন আউট',
  language: 'English',
  languageLabel: 'ইংরেজিতে দেখুন',
  themeLight: 'লাইট থিম',
  themeDark: 'ডার্ক থিম',
  themeSystem: 'সিস্টেমের থিম',
  accountMenu: 'অ্যাকাউন্ট মেনু',
  syncedAs: '{name} হিসেবে সিঙ্ক হচ্ছে',
  deviceOnly: 'এই ডিভাইসে সংরক্ষিত',
  deleteCloudData: 'আমার সংরক্ষিত তথ্য মুছুন',
  deleteCloudConfirm: 'আপনার অ্যাকাউন্ট থেকে সব সংরক্ষিত নম্বর ও ইতিহাস মুছে ফেলবেন? এটি আর ফেরানো যাবে না।',
  cloudDeleted: 'আপনার সংরক্ষিত তথ্য মুছে ফেলা হয়েছে',

  checkTitle: 'বিল দেখুন',
  customerNo: 'কাস্টমার নম্বর',
  customerNoHint: 'বিলে ছাপা থাকে, সাধারণত ৮ সংখ্যার। বাংলা সংখ্যাও লেখা যাবে।',
  customerNoPlaceholder: 'যেমন ১২৩৪৫৬৭৮',
  errEmpty: 'কাস্টমার নম্বর লিখুন',
  errNotDigits: 'শুধু সংখ্যা লিখুন',
  errLength: 'কাস্টমার নম্বর {min}–{max} সংখ্যার হয়',
  savedAccounts: 'সংরক্ষিত নম্বর',
  otherNumber: 'অন্য নম্বর',
  saveThisNumber: 'পরের বারের জন্য নম্বরটি সংরক্ষণ করুন',
  saveAs: 'নাম দিয়ে রাখুন',
  nickname: 'ডাকনাম',
  nicknamePlaceholder: 'যেমন বাসা, দোকান, মায়ের ফ্ল্যাট',
  billType: 'বিলের ধরন',
  bt_current: 'ই-বিল',
  bt_current_desc: 'নির্বাচিত মাসের বিল, টাকার পরিমাণ ও শেষ তারিখসহ।',
  bt_summary: 'লেজার',
  bt_summary_desc: 'অ্যাকাউন্টের বিল ও পরিশোধের ইতিহাস।',
  bt_misc: 'মিস-বিল',
  bt_misc_desc: 'পুনঃসংযোগ বা মিটার ফি-র মতো অন্যান্য চার্জ।',
  billMonth: 'বিলের মাস',
  month: 'মাস',
  year: 'বছর',
  futureMonth: '{month}-এর বিল {next}-এর ৭ তারিখের পরে তৈরি হয়, তাই এখনো নাও থাকতে পারে।',
  latestBillChip: 'সর্বশেষ · {month}',
  moreOptions: 'আরও অপশন',
  emailCopy: 'ই-মেইলে কপি (ঐচ্ছিক)',
  emailHint: 'ডিপিডিসি এই ঠিকানায় বিল পাঠাতে পারে। পরের বারের জন্য মনে রাখা হবে।',
  errEmail: 'ই-মেইল ঠিকানাটি সঠিক মনে হচ্ছে না',
  checkButton: 'ডিপিডিসিতে বিল দেখুন',
  copyLink: 'লিংক কপি',
  share: 'শেয়ার',
  linkCopied: 'লিংক কপি হয়েছে',
  copyFailed: 'কপি করা যায়নি। লিংকটি চেপে ধরে কপি করুন।',
  openedTitle: 'নতুন ট্যাবে ডিপিডিসি খুলেছে',
  openedTitlePopup: 'নতুন উইন্ডোতে ডিপিডিসি খুলেছে',
  openAgainWindow: 'ডিপিডিসি উইন্ডো আবার দেখান',
  openedBody: 'সব তথ্য পূরণ করা আছে। ওই পাতায় দেখানো ৫ অক্ষরের সিকিউরিটি কোড লিখে সার্চ বাটন চাপুন।',
  popupBlocked: 'আপনার ব্রাউজার নতুন ট্যাব খুলতে দেয়নি।',
  openManually: 'ডিপিডিসি বিল পাতা খুলুন',
  numberSaved: '“{name}” সংরক্ষিত হয়েছে',

  whyCaptcha:
    'ডিপিডিসি বিল সিকিউরিটি কোড দিয়ে সুরক্ষিত, তাই বিল অফিসিয়াল সাইটেই খোলে। আমরা আপনার বিল দেখি না।',

  accountsTitle: 'সংরক্ষিত নম্বর',
  addNumber: 'নম্বর যোগ করুন',
  noAccounts: 'এখনো কোনো নম্বর সংরক্ষিত নেই। একটি সংরক্ষণ করলে পরের বার নিজে থেকেই পূরণ হবে।',
  default: 'ডিফল্ট',
  makeDefault: 'ডিফল্ট করুন',
  edit: 'সম্পাদনা',
  delete: 'মুছুন',
  check: 'দেখুন',
  deleteConfirm: '“{name}” সংরক্ষিত নম্বর থেকে মুছবেন?',
  removed: '“{name}” মুছে ফেলা হয়েছে',
  undo: 'ফেরান',
  addTitle: 'কাস্টমার নম্বর যোগ করুন',
  editTitle: 'সংরক্ষিত নম্বর সম্পাদনা',
  save: 'সংরক্ষণ',
  cancel: 'বাতিল',
  close: 'বন্ধ',
  duplicate: 'এই নম্বরটি “{name}” নামে আগেই সংরক্ষিত',
  untitled: 'অ্যাকাউন্ট {no}',

  historyTitle: 'সাম্প্রতিক চেক',
  noHistory: 'আপনি যে বিল দেখবেন তা এখানে থাকবে, যাতে এক ট্যাপে আবার খুলতে পারেন।',
  clearHistory: 'মুছুন',
  clearHistoryConfirm: 'সাম্প্রতিক চেক মুছে ফেলবেন?',
  openAgain: 'আবার খুলুন',

  reminderTitle: 'মাসিক রিমাইন্ডার',
  reminderBody: 'ফোন বা কম্পিউটারের ক্যালেন্ডারে প্রতি মাসের রিমাইন্ডার যোগ করুন। প্রতি মাসের ৭ তারিখের পরে নতুন বিল পাওয়া যায়।',
  reminderDay: 'মাসের যে তারিখে মনে করাবে',
  reminderButton: 'ক্যালেন্ডারে যোগ করুন',
  reminderEventTitle: 'ডিপিডিসি বিদ্যুৎ বিল দেখুন',
  reminderEventBody: 'এই মাসের বিল দেখতে ডিপিডিসি বিল চেক খুলুন।',
  reminderDownloaded: 'ক্যালেন্ডার ফাইল ডাউনলোড হয়েছে। রিমাইন্ডার যোগ করতে ফাইলটি খুলুন।',

  syncBannerTitle: 'সব ডিভাইসে নম্বর রাখুন',
  syncBannerBody: 'সাইন ইন করলে সংরক্ষিত নম্বর ও সাম্প্রতিক চেক ফোন ও কম্পিউটারে সিঙ্ক হবে।',

  authTitle: 'সিঙ্কের জন্য সাইন ইন',
  authSubtitle: 'আপনার সংরক্ষিত নম্বর সব ডিভাইসে পাবেন। এখানে আগে সংরক্ষিত নম্বরও থাকবে।',
  continueGoogle: 'Google দিয়ে চালিয়ে যান',
  or: 'অথবা',
  email: 'ই-মেইল',
  password: 'পাসওয়ার্ড',
  name: 'আপনার নাম (ঐচ্ছিক)',
  signInButton: 'সাইন ইন',
  createAccount: 'অ্যাকাউন্ট খুলুন',
  createAccountButton: 'অ্যাকাউন্ট খুলুন',
  haveAccount: 'আগেই অ্যাকাউন্ট আছে?',
  noAccount: 'নতুন?',
  forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
  sendReset: 'রিসেট লিংক পাঠান',
  backToSignIn: 'সাইন ইনে ফিরে যান',
  resetTitle: 'পাসওয়ার্ড রিসেট করুন',
  resetSent: 'পাসওয়ার্ড রিসেটের লিংকের জন্য ইনবক্স দেখুন।',
  showPassword: 'পাসওয়ার্ড দেখান',
  hidePassword: 'পাসওয়ার্ড লুকান',
  passwordHint: 'কমপক্ষে ৬ অক্ষর',
  signedIn: 'সাইন ইন হয়েছে। আপনার নম্বর সিঙ্ক হবে।',
  signedOut: 'সাইন আউট হয়েছে',
  imported: 'এই ডিভাইস থেকে {count}টি নম্বর আপনার অ্যাকাউন্টে যোগ হয়েছে',
  syncError: 'সিঙ্ক করা যায়নি। অনলাইনে ফিরলে আবার চেষ্টা করা হবে।',
  authUnavailable: 'এই সাইটে এখনো সাইন ইন চালু হয়নি। আপনার নম্বর এই ডিভাইসে সংরক্ষিত।',
  ae_invalid: 'ই-মেইল বা পাসওয়ার্ড ভুল',
  ae_inUse: 'এই ই-মেইলে আগেই অ্যাকাউন্ট আছে। সাইন ইন করে দেখুন।',
  ae_weak: 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন',
  ae_email: 'সঠিক ই-মেইল ঠিকানা লিখুন',
  ae_tooMany: 'অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।',
  ae_network: 'ইন্টারনেট সংযোগ নেই। সংযোগ দেখে আবার চেষ্টা করুন।',
  ae_generic: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',

  billsTitle: 'বিলের ইতিহাস',
  uploadBills: 'বিলের PDF আপলোড',
  addManually: 'নিজে যোগ করুন',
  billsEmpty: 'ডিপিডিসি থেকে ডাউনলোড করা বিলের PDF আপলোড করুন। অ্যাপটি এই ডিভাইসেই সেগুলো পড়ে প্রতি মাসের সারাংশ রাখে: টাকার পরিমাণ, ইউনিট ও শেষ তারিখ।',
  billsPrivacy: 'PDF শুধু আপনার ডিভাইসে পড়া হয়, কোথাও আপলোড হয় না। শুধু সারাংশ সংরক্ষিত হয়।',
  dropHere: 'বিলের PDF এখানে ছাড়ুন',
  latestBill: 'সর্বশেষ বিল',
  average: '{n} মাসের গড়',
  highest: 'সর্বোচ্চ',
  amount: 'টাকা (৳)',
  lateAmount: 'শেষ তারিখের পর (৳)',
  lateAmountShort: 'তারিখের পর',
  presentReading: 'বর্তমান রিডিং',
  previousReading: 'পূর্ববর্তী রিডিং',
  meterReading: 'মিটার রিডিং',
  units: 'ইউনিট (kWh)',
  dueDate: 'শেষ তারিখ',
  noDueDate: '—',
  billChartLabel: 'মাসভিত্তিক বিলের পরিমাণ',
  editBill: 'বিল সম্পাদনা',
  deleteBill: 'বিল মুছুন',
  billDeleted: '{month}-এর বিল মুছে ফেলা হয়েছে',
  status: 'অবস্থা',
  paid: 'পরিশোধিত',
  unpaid: 'বাকি',
  overdue: 'মেয়াদোত্তীর্ণ',
  markPaid: 'পরিশোধিত চিহ্নিত করুন',
  markUnpaid: 'বাকি হিসেবে চিহ্নিত করুন',
  editPayment: 'পরিশোধের তথ্য বদলান',
  paidOn: 'পরিশোধের তারিখ',
  paidLockedNote: 'পরিশোধিত বিল লক থাকে। সম্পাদনা বা মুছতে হলে আগে বাকি হিসেবে চিহ্নিত করুন।',
  billMarkedPaid: '{month}-এর বিল পরিশোধিত চিহ্নিত হয়েছে',
  billMarkedUnpaid: '{month}-এর বিল বাকি হিসেবে চিহ্নিত হয়েছে',
  unpaidSummary: '{count}টি বিল বাকি · {amount}',
  billPaidLocked: '{month}-এর বিল পরিশোধিত চিহ্নিত, তাই বদলানো যাবে না। অন্য মাস বেছে নিন বা এটি বাদ দিন।',
  billsSaved: '{count}টি বিল সংরক্ষিত হয়েছে',
  billReplaced: 'সংরক্ষিত {month}-এর বিলের জায়গায় বসবে',
  importTitle: 'বিলের তথ্য মিলিয়ে দেখুন',
  importSubtitle: 'আপনার PDF থেকে পড়া হয়েছে। ভুল থাকলে ঠিক করে সংরক্ষণ করুন।',
  manualTitle: 'বিল যোগ করুন',
  reading: '{name} পড়া হচ্ছে…',
  notFound: 'PDF-এ পাওয়া যায়নি — অনুগ্রহ করে লিখুন',
  warnNoText: 'এই PDF-এ পড়ার মতো লেখা নেই (স্ক্যান বা ছবি হতে পারে)। অনুগ্রহ করে তথ্যগুলো লিখুন।',
  warnBangla: 'এই PDF-এ পুরোনো বাংলা ফন্ট আছে যা অ্যাপ পড়তে পারে না। কিছু সংখ্যা পাওয়া যেতে পারে — সব ঘর মিলিয়ে দেখুন।',
  errTooBig: 'ফাইলটি ১০ MB-এর বেশি।',
  errNotPdf: 'এটি PDF ফাইল নয়।',
  errProtected: 'এই PDF পাসওয়ার্ড দিয়ে সুরক্ষিত।',
  errBroken: 'এই PDF খোলা যায়নি।',
  errAmount: 'বিলের টাকার পরিমাণ লিখুন',
  errMonth: 'বিলের মাস বাছুন',
  skipFile: 'বাদ দিন',
  saveBills: '{count}টি বিল সংরক্ষণ',
  willAddNumber: 'এই নম্বরটি আপনার সংরক্ষিত নম্বরে যোগ হবে।',

  footerDisclaimer:
    'ডিপিডিসির সাথে সম্পর্কিত নয়। বিল শুধু অফিসিয়াল সাইট dpdc.org.bd-তে দেখানো হয়। সাইন ইন না করলে সংরক্ষিত নম্বর শুধু এই ডিভাইসে থাকে।',
  officialSite: 'ডিপিডিসির অফিসিয়াল ওয়েবসাইট',
  offline: 'আপনি অফলাইনে আছেন। সংরক্ষিত নম্বর দেখা যাবে, তবে ডিপিডিসির জন্য ইন্টারনেট লাগবে।',
  justNow: 'এইমাত্র',
}

export type Lang = 'en' | 'bn'
const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, bn }
const LANG_KEY = 'dpdc-bill-check:lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'bn') return saved
  } catch {
    /* ignore */
  }
  return navigator.language?.toLowerCase().startsWith('bn') ? 'bn' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = dictionaries[lang].appName
  }, [lang])

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[lang]
    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB'
    const numberFmt = new Intl.NumberFormat(locale, { useGrouping: false })
    const formatNumber = (n: number) => numberFmt.format(n)
    const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long' })
    const monthName = (month: number) => monthFmt.format(new Date(2000, month - 1, 1))
    const shortMonthFmt = new Intl.DateTimeFormat(locale, { month: 'short' })
    const moneyFmt = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 2 })
    const groupedFmt = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 1 })
    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    return {
      lang,
      setLang,
      locale,
      formatNumber,
      monthName,
      shortMonth: (month) => shortMonthFmt.format(new Date(2000, month - 1, 1)),
      formatMoney: (n) => `৳${moneyFmt.format(n)}`,
      formatQuantity: (n) => groupedFmt.format(n),
      formatDate: (iso) => {
        const [y, m, d] = iso.split('-').map(Number)
        return dateFmt.format(new Date(y, m - 1, d))
      },
      t: (key, vars) =>
        dict[key].replace(/\{(\w+)\}/g, (_, name: string) => {
          const v = vars?.[name]
          return v === undefined ? `{${name}}` : typeof v === 'number' ? formatNumber(v) : v
        }),
      formatPeriod: (year, month) => `${monthName(month)} ${formatNumber(year)}`,
      relativeTime: (timestamp) => {
        const seconds = Math.round((timestamp - Date.now()) / 1000)
        const abs = Math.abs(seconds)
        if (abs < 45) return dict.justNow
        if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
        if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
        if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day')
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(timestamp)
      },
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
