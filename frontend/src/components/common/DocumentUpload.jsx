import React, { useState, useRef } from 'react';
import { Upload, File, FileText, Download, Trash2, X } from 'lucide-react';

export default function DocumentUpload({ onFilesAdded = () => {} }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'pdf';
    if (['doc', 'docx', 'txt'].includes(ext)) return 'doc';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
    return 'file';
  };

  const getFileColor = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return 'text-red-600';
    if (['doc', 'docx', 'txt'].includes(ext)) return 'text-blue-600';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-green-600';
    return 'text-gray-600';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });

    const filesWithId = validFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date(),
      progress: 0,
    }));

    setFiles([...files, ...filesWithId]);
    onFilesAdded(filesWithId);

    // Simulate upload progress
    filesWithId.forEach((file) => {
      simulateUpload(file.id);
    });
  };

  const simulateUpload = (fileId) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadProgress((prev) => ({ ...prev, [fileId]: progress }));
    }, 300);
  };

  const handleFileInputChange = (e) => {
    handleFiles(e.target.files);
  };

  const handleRemoveFile = (fileId) => {
    setFiles(files.filter((f) => f.id !== fileId));
    setUploadProgress((prev) => {
      const updated = { ...prev };
      delete updated[fileId];
      return updated;
    });
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[#3d61a4] bg-[#eef2fa]'
            : 'border-[#cdd1e0] bg-[#f7f8fc] hover:border-[#a4abbe]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.pptx"
        />

        <Upload size={32} className="mx-auto text-[#a4abbe] mb-3" />
        <p className="font-semibold text-[#011745] mb-1">Drop documents here or click to browse</p>
        <p className="text-sm text-[#7b859e]">Support for PDF, Word, Excel, PowerPoint (max 50MB per file)</p>
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[#011745]">Uploaded Files ({files.length})</h4>
          {files.map((file) => {
            const progress = uploadProgress[file.id] || 0;
            const isComplete = progress >= 100;

            return (
              <div key={file.id} className="bg-white border border-[#e8eaf2] rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText size={20} className={`${getFileColor(file.name)} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#011745] truncate">{file.name}</p>
                      <p className="text-sm text-[#7b859e]">{formatFileSize(file.size)}</p>

                      {/* Progress Bar */}
                      {!isComplete && (
                        <div className="mt-2 h-1 bg-[#e8eaf2] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3d61a4] transition-all"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isComplete && (
                      <>
                        <button className="p-2 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-[#3d61a4]">
                          <Download size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="p-2 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e] hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
