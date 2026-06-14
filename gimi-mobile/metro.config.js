// metro.config.js
// Fixes: "Cannot use 'import.meta' outside a module" on Expo web.
// Root cause: zustand ships an ESM /esm/*.mjs variant that uses import.meta.env.
// Metro web picks up .mjs before .js, hitting the import.meta syntax error.
// Solution: add a resolver transform that rewrites the offending .mjs imports
// to their CJS .js equivalents, which Metro can handle without issues.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Prefer .js over .mjs so CJS builds win over ESM builds in node_modules
const currentSourceExts = config.resolver.sourceExts ?? [];
// Remove 'mjs' if already present, then re-add it at the END so .js wins
config.resolver.sourceExts = [
    ...currentSourceExts.filter((ext) => ext !== 'mjs'),
    'mjs',
];

// 2. Force Metro to resolve specific zustand ESM paths to their CJS equivalents
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Map zustand ESM subpaths → CJS equivalents
    const zustandEsmMap = {
        'zustand/esm/middleware': 'zustand/middleware',
        'zustand/esm/react': 'zustand/react',
        'zustand/esm/vanilla': 'zustand/vanilla',
        'zustand/esm/traditional': 'zustand/traditional',
        'zustand/esm': 'zustand',
    };

    if (zustandEsmMap[moduleName]) {
        return context.resolveRequest(context, zustandEsmMap[moduleName], platform);
    }

    if (originalResolveRequest) {
        return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
