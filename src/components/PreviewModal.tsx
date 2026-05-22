// src/components/PreviewModal.tsx
import React from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import CodePreviewer from "@/components/CodePreviewer";

interface PreviewModalProps {
    fileId: string;
    fileName: string;
    fileUrl: string;
    currentDir: string | null;
}

export default async function PreviewModal({ fileId, fileName, fileUrl, currentDir }: PreviewModalProps) {
    let textContent = '';
    const isDistributed = fileUrl.trim().startsWith('[') || fileUrl.trim().startsWith('{');
    const finalImageSrc = isDistributed
        ? `/api/video/stream?file_id=${fileId}`
        : fileUrl;
    const downloadProxyUrl = `/api/download?file_id=${fileId}`;

    // 自动洗白分片后的多媒体后缀
    const lowerName = fileName.toLowerCase();
    let ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
    if (lowerName.includes('.mp3.part')) ext = 'mp3';
    else if (lowerName.includes('.mp4.part')) ext = 'mp4';

    const isTextFile = ['md', 'txt', 'js', 'ts', 'py', 'json', 'html', 'css', 'csv'].includes(ext || '');


    if (isTextFile && fileUrl) {
        try {
            const res = await fetch(fileUrl);
            if (res.ok) {
                textContent = await res.text();
            } else {
                textContent = `读取文件失败，状态码: ${res.status}`;
            }
        } catch (err: any) {
            textContent = `从云端拉取内容失败: ${err.message}`;
        }
    }

    // 动态计算关闭弹窗后的返回路由（维持当前浏览的文件夹）
    const closeUrl = currentDir ? `/?currentDir=${currentDir}` : '/';

    const renderContent = () => {
        switch (ext) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
                return (
                    /* 外部钩子: pangu-preview-image-wrapper */
                    <div className="pangu-preview-image-wrapper flex justify-center items-center max-h-[70vh]">
                        <img
                            src={finalImageSrc}
                            alt={fileName}
                            /* 外部钩子: pangu-preview-image */
                            className="pangu-preview-image max-w-full max-h-[70vh] object-contain rounded"
                        />
                    </div>
                );

            case 'mp4':
            case 'webm':
            case 'mkv':
            case 'mov':
                return (
                    /* 外部钩子: pangu-preview-video-wrapper */
                    <div className="pangu-preview-video-wrapper flex justify-center items-center bg-black rounded overflow-hidden">
                        {/* 外部钩子: pangu-preview-video */}
                        <video src={`/api/video/stream?file_id=${fileId}`} controls preload="metadata" className="pangu-preview-video w-full max-h-[70vh]" />
                    </div>
                );

            case 'md':
                return (
                    /* 外部钩子: pangu-preview-markdown-wrapper */
                    <div className="pangu-preview-markdown-wrapper prose max-w-none max-h-[70vh] overflow-y-auto p-4 bg-white rounded border">
                        <ReactMarkdown>{textContent}</ReactMarkdown>
                    </div>
                );

            case 'js':
            case 'ts':
            case 'py':
            case 'json':
            case 'html':
            case 'css':
                return (
                    /* 外部钩子: pangu-preview-code-wrapper */
                    <div className="pangu-preview-code-wrapper max-h-[70vh] overflow-y-auto rounded text-sm border">
                        <CodePreviewer fileUrl={fileUrl} ext={ext || 'js'} />
                    </div>
                );

            case 'docx':
            case 'doc':
            case 'pptx':
            case 'ppt':
                // const microsoftViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${(fileUrl)}`;
                return (
                    /* 外部钩子: pangu-preview-office-iframe */
                    <h1 className="pangu-preview-office-iframe w-full h-[70vh] border rounded" title="office-preview">目前还不支持office文件预览，敬请期待</h1>
                );

            case 'txt':
            case 'csv':
                return (
                    /* 外部钩子: pangu-preview-text-pre */
                    <pre className="pangu-preview-text-pre p-4 bg-gray-50 rounded max-h-[70vh] overflow-y-auto text-xs whitespace-pre-wrap font-mono">
                        {textContent}
                    </pre>
                );

            case 'mp3':
            case 'wav':
            case 'aac':
            case 'flac':
            case 'm4a':
                return (
                    /* 外部钩子: pangu-preview-audio-wrapper */
                    <div className="pangu-preview-audio-wrapper flex flex-col items-center justify-center py-12 px-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-inner text-white">
                        {/* 外部钩子: pangu-preview-audio-disc */}
                        <div className="pangu-preview-audio-disc w-28 h-28 bg-black border-4 border-gray-700 rounded-full flex items-center justify-center shadow-2xl mb-8 animate-[spin_8s_linear_infinite] relative before:content-[''] before:w-8 before:h-8 before:bg-gray-800 before:rounded-full before:border-4 before:border-gray-900">
                            <span className="absolute text-xl">🎵</span>
                        </div>
                        {/* 外部钩子: pangu-preview-audio-title */}
                        <p className="pangu-preview-audio-title text-sm font-medium text-gray-300 mb-6 truncate max-w-md">{fileName}</p>
                        {/* 外部钩子: pangu-preview-audio */}
                        <audio src={`/api/video/stream?file_id=${fileId}&t=${Date.now()}`} controls preload="metadata" className="pangu-preview-audio w-full max-w-xl outline-none" />
                    </div>
                );


            case 'pdf':
                return (
                    /* 外部钩子: pangu-preview-pdf-unsupported */
                    <h1 className="pangu-preview-pdf-unsupported">目前还不支持pdf预览, s∞n!</h1>
                );

            default:
                return (
                    /* 外部钩子: pangu-preview-unsupported-wrapper */
                    <div className="pangu-preview-unsupported-wrapper text-center py-10">
                        <p className="text-sm text-gray-500 mb-4">⚠️ 该文件格式（.${ext}）暂不支持直接预览</p>
                        <a href={downloadProxyUrl} target="_blank" rel="noreferrer" className="pangu-preview-unsupported-download text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                            在新标签页中打开/下载
                        </a>
                    </div>
                );
        }
    };

    return (
        /* 弹窗遮罩层外部钩子：pangu-modal-mask + data-ext 属性透传 */
        <div className="pangu-modal-mask fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-ext={ext}>

            {/* 弹窗主身体外部钩子：pangu-modal-body */}
            <div className="pangu-modal-body bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* 弹窗头部栏外部钩子：pangu-modal-header */}
                <div className="pangu-modal-header px-6 py-4 border-b flex items-center justify-between bg-gray-50">
                    {/*  外部钩子: pangu-modal-title */}
                    <h3 className="pangu-modal-title font-semibold text-gray-800 truncate max-w-lg">{fileName}</h3>
                    {/* 外部钩子: pangu-modal-close-btn */}
                    <Link href={closeUrl} className="pangu-modal-close-btn text-gray-400 hover:text-gray-600 p-1 text-lg font-bold">✕</Link>
                </div>

                {/* 弹窗主视窗外部钩子：pangu-modal-content */}
                <div className="pangu-modal-content p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}