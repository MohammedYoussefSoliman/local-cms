// internationalization CMS apps

enum DefaultLanguage {
  AR = "ar",
  EN = "en",
}

export type LocalizeType = Record<DefaultLanguage, string>;

export type AppType = {
  name: string;
  id: string; // primary key
};

export type ModuleType = {
  name: LocalizeType;
  id: string; // primary key
  app_id: string; // foreign key to AppType
  locales: LocalizationEntityType[]; // joined locale table
};

export type LocalizationEntityType = {
  name: string;
  values: LocalizeType; // {ar: '...', en: '...'}
  id: string; // primary key
  module_id: string; // foreign key to AppType
  app_id: string; // foreign key to AppType
};
