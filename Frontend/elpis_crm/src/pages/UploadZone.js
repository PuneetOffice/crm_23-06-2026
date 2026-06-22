import React, { useRef, useState } from "react";
import { FiUpload, FiFile, FiX } from "react-icons/fi";

function UploadZone({ onFileSelect, selectedFile, isLoading, supportedFormats = [".xlsx", ".xlsb", ".xls", ".csv"], maxSizeMB = 50 }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file) => {
    setError("");
    
    // Check file size
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds ${maxSizeMB}MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      return false;
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = supportedFormats.some(ext => fileName.endsWith(ext.toLowerCase()));
    if (!hasValidExtension) {
      setError(`Invalid file format. Supported formats: ${supportedFormats.join(", ")}`);
      return false;
    }

    return true;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      } else if (e.type === "dragleave") {
        setDragActive(false);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isLoading || !e.dataTransfer.files) return;

    const file = e.dataTransfer.files[0];
    if (validateFile(file)) {
      onFileSelect(file);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    onFileSelect(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : selectedFile
            ? "border-green-300 bg-green-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleChange}
          accept={supportedFormats.join(",")}
          className="hidden"
          disabled={isLoading}
          aria-label="Upload file"
        />

        {!selectedFile ? (
          <>
            <div className="flex justify-center mb-2">
              <FiUpload size={24} className="text-gray-400" />
            </div>
            <p className="text-xs font-medium text-gray-700 mb-1">
              Drag and drop your file here
            </p>
            <p className="text-xs text-gray-500 mb-2">or</p>
            <button
              type="button"
              onClick={(e) => {e.stopPropagation(); handleClick();}}
              disabled={isLoading}
              className="inline-block px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Supported formats: {supportedFormats.join(", ")} • Max size: {maxSizeMB}MB
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 rounded-lg">
                <FiFile size={16} className="text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-gray-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)}MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Remove file"
            >
              <FiX size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <div className="text-red-500 mt-0.5 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

export default UploadZone;
