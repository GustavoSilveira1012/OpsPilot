module.exports = [
"[project]/apps/web/src/components/api-status.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ApiStatus",
    ()=>ApiStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@babel+core@7.2_7a0d28a2466cf1890b30b9b40bf43cfc/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.4.2_@babel+core@7.2_7a0d28a2466cf1890b30b9b40bf43cfc/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
;
function isHealthResponse(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return 'status' in value && value.status === 'ok' && 'service' in value && value.service === 'opspilot-api' && 'version' in value && typeof value.version === 'string' && 'timestamp' in value && typeof value.timestamp === 'string';
}
function ApiStatus() {
    const [connection, setConnection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        status: 'checking'
    });
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const controller = new AbortController();
        let isCurrent = true;
        async function loadConnection() {
            try {
                const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, {
                    cache: 'no-store',
                    signal: controller.signal
                });
                const payload = await response.json();
                if (!response.ok || !isHealthResponse(payload)) {
                    throw new Error('Health endpoint returned an unexpected response.');
                }
                if (isCurrent) {
                    setConnection({
                        status: 'connected',
                        checkedAt: new Date().toISOString(),
                        health: payload
                    });
                }
            } catch  {
                if (isCurrent && !controller.signal.aborted) {
                    setConnection({
                        status: 'unavailable',
                        checkedAt: new Date().toISOString()
                    });
                }
            }
        }
        void loadConnection();
        return ()=>{
            isCurrent = false;
            controller.abort();
        };
    }, [
        apiBaseUrl
    ]);
    if (connection.status === 'checking') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            "aria-live": "polite",
            className: "connection-state",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "state-icon state-icon-pending",
                    "aria-hidden": "true",
                    children: "…"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/api-status.tsx",
                    lineNumber: 73,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "connection-title",
                            children: "Checking service"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/api-status.tsx",
                            lineNumber: 77,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "connection-detail",
                            children: "Waiting for the API health check."
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/api-status.tsx",
                            lineNumber: 78,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/src/components/api-status.tsx",
                    lineNumber: 76,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/src/components/api-status.tsx",
            lineNumber: 72,
            columnNumber: 7
        }, this);
    }
    if (connection.status === 'unavailable') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            "aria-live": "polite",
            className: "connection-state",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "state-icon state-icon-down",
                    "aria-hidden": "true",
                    children: "!"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/api-status.tsx",
                    lineNumber: 87,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "connection-title",
                            children: "API unavailable"
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/api-status.tsx",
                            lineNumber: 91,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "connection-detail",
                            children: [
                                "Start the API with ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                    children: "pnpm dev"
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/api-status.tsx",
                                    lineNumber: 93,
                                    columnNumber: 32
                                }, this),
                                " to connect."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/components/api-status.tsx",
                            lineNumber: 92,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/src/components/api-status.tsx",
                    lineNumber: 90,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/src/components/api-status.tsx",
            lineNumber: 86,
            columnNumber: 7
        }, this);
    }
    const checkedTime = new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(connection.checkedAt));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-live": "polite",
        className: "connection-state",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "state-icon state-icon-up",
                "aria-hidden": "true",
                children: "✓"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/api-status.tsx",
                lineNumber: 107,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "connection-title",
                        children: "All systems operational"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/api-status.tsx",
                        lineNumber: 111,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$4$2e$2_$40$babel$2b$core$40$7$2e$2_7a0d28a2466cf1890b30b9b40bf43cfc$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "connection-detail",
                        children: [
                            "Health check passed at ",
                            checkedTime,
                            " · ",
                            connection.health.version
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/api-status.tsx",
                        lineNumber: 112,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/api-status.tsx",
                lineNumber: 110,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/api-status.tsx",
        lineNumber: 106,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=apps_web_src_components_api-status_tsx_07gnrvepgyxxo._.js.map