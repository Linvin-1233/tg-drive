// src/components/CodePreviewer.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface CodePreviewerProps {
    fileUrl: string;
    ext: string;
}

export default function CodePreviewer({ fileUrl, ext }: CodePreviewerProps) {
    const [textContent, setTextContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [forceLoad, setForceLoad] = useState<boolean>(false);

    useEffect(() => {
        if (!fileUrl) return;
        setLoading(true);
        const proxyUrl = `/api/proxy-text?url=${encodeURIComponent(fileUrl)}`;
        fetch(proxyUrl)
            .then(res => {
                if (!res.ok) throw new Error();
                return res.arrayBuffer();
            })
            .then(buffer => {
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(buffer);
                setTextContent(text);
                setLoading(false);
            })
            .catch(() => {
                setTextContent('// BUFFER_LOAD_FAILED: 远程代码片段读取断开');
                setLoading(false);
            });
    }, [fileUrl]);

    const { lines, totalLines, isOverLimit } = useMemo(() => {
        if (!textContent) return { lines: [], totalLines: 0, isOverLimit: false };
        const allLines = textContent.split('\n');
        return {
            lines: allLines,
            totalLines: allLines.length,
            isOverLimit: allLines.length > 300
        };
    }, [textContent]);

    const displayContent = useMemo(() => {
        if (!isOverLimit || forceLoad) return textContent;
        return lines.slice(0, 300).join('\n');
    }, [textContent, lines, isOverLimit, forceLoad]);

    const targetLang = ext === 'ts' ? 'typescript' : ext === 'js' ? 'javascript' : ext;

    if (loading) {
        return (
            <div className="pangu-preview-loading w-full h-[350px] flex flex-col items-center justify-center p-12">
                <div className="loading-spinner"></div>
                <p>CORE_SYS: 正在安全拉取远端文本流...</p>
            </div>
        );
    }

    return (
        <div className="pangu-preview-code-wrapper relative w-full h-full min-h-[300px] flex flex-col overflow-hidden">

            {/* 顶栏 */}
            <div className="pangu-preview-header px-4 py-2 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <span className={`status-dot ${isOverLimit && !forceLoad ? 'is-warn' : 'is-ok'}`}></span>
                    <span>{isOverLimit && !forceLoad ? 'WARN // 物理截断模式' : 'STATUS // 语法解析正常'}</span>
                </div>
                <div>
                    LINES: <span className="total-lines">{totalLines}</span> · LANG: <span className="lang-tag">{ext}</span>
                </div>
            </div>

            <div className={`pangu-code-body overflow-y-auto flex-1 ${isOverLimit && !forceLoad ? 'has-mask' : ''}`}>
                <SyntaxHighlighter
                    language={targetLang}
                    useInlineStyles={false}
                    showLineNumbers={true}
                    PreTag="div"
                    CodeTag="div"
                    className="pangu-prism-sandbox"
                    customStyle={{
                        color: '#99aab5',
                        textShadow: 'none',
                        background: 'transparent',
                        padding: '1.25rem',
                        fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                    }}
                >
                    {displayContent}
                </SyntaxHighlighter>
            </div>


            {isOverLimit && !forceLoad && (
                <div className="pangu-preview-mask absolute bottom-0 left-0 right-0 h-36 flex flex-col items-center justify-end pb-6 gap-3 z-20">
                    <p className="mask-text">
                        为了保护浏览器性能，已自动截断后续 <span className="truncated-count">{totalLines - 300}</span> 行。
                    </p>
                    <button onClick={() => setForceLoad(true)} className="override-btn">
                        [ 强行加载全量数据 ]
                    </button>
                </div>
            )}
        </div>
    );
}