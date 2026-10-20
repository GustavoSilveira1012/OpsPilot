import { base } from '@opspilot/eslint-config/base';

export default [
  ...base,
  {
    languageOptions: {
      // NestJS uses decorated class types as runtime dependency/validation metadata.
      parserOptions: { experimentalDecorators: true, emitDecoratorMetadata: true },
    },
  },
];
