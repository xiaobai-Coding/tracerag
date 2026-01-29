import { createI18n } from 'vue-i18n';
import zh from './locales/zh.json';
import en from './locales/en.json';

// 定义 i18n Schema 类型，用于类型提示
export type MessageSchema = typeof zh;

// 获取浏览器语言
const getBrowserLanguage = () => {
  const lang = (navigator.language || 'zh').split('-')[0] || 'en';
  const supported = ['zh', 'en'];
  return supported.includes(lang) ? (lang as 'zh' | 'en') : 'en';
};

// 获取持久化的语言设置
const savedLanguage = localStorage.getItem('locale');
const defaultLocale = (savedLanguage && ['zh', 'en'].includes(savedLanguage)) ? (savedLanguage as 'zh' | 'en') : getBrowserLanguage();

const i18n = createI18n<[MessageSchema], 'zh' | 'en'>({
  legacy: false, // 使用 Composition API 模式
  globalInjection: true,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    zh,
    en
  }
});

export default i18n;

// 提供一个全局修改语言的方法并持久化
export const setLanguage = (lang: 'zh' | 'en') => {
  // @ts-ignore - vue-i18n type mismatch in some environments
  i18n.global.locale.value = lang;
  localStorage.setItem('locale', lang);
  document.documentElement.lang = lang;
};
