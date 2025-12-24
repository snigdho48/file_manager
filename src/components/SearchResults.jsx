import React from 'react'
import { Search, X, Folder, File } from 'lucide-react'

const SearchResults = ({ query, results, isSearching, onClearSearch, onFileClick, onFileDoubleClick, onFileContextMenu }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getFileIcon = (file) => {
    return file.type === 'directory' 
      ? <Folder className="w-5 h-5 text-primary-500" />
      : <File className="w-5 h-5 text-gray-500" />
  }

  const highlightMatch = (text, query) => {
    if (!query) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Search className="w-6 h-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Search Results
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isSearching 
                  ? 'Searching...'
                  : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={onClearSearch}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 transition-colors duration-200"
          >
            <X className="w-4 h-4 mr-2" />
            Clear Search
          </button>
        </div>
      </div>

      {/* Results content */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="spinner w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Searching files...</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                No files found
              </h3>
              <p className="text-gray-400 dark:text-gray-500">
                No files matching "{query}" were found.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table header */}
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <div className="col-span-6">Name</div>
                <div className="col-span-3">Path</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-1">Type</div>
              </div>
            </div>

            {/* Results list */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {results.map((file, index) => (
                <div
                  key={`${file.path}-${index}`}
                  className="group grid grid-cols-12 gap-4 items-center px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  onClick={(e) => onFileClick(file, e)}
                  onDoubleClick={() => onFileDoubleClick(file)}
                  onContextMenu={(e) => onFileContextMenu(file, e)}
                >
                  {/* Name column */}
                  <div className="col-span-6 flex items-center space-x-3 min-w-0">
                    <div className="flex-shrink-0">
                      {getFileIcon(file)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {highlightMatch(file.name, query)}
                      </p>
                    </div>
                  </div>

                  {/* Path column */}
                  <div className="col-span-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate" title={file.path}>
                      {file.path ? `/${file.path}` : '/'}
                    </p>
                  </div>

                  {/* Size column */}
                  <div className="col-span-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {file.type === 'directory' ? '—' : file.size}
                    </span>
                  </div>

                  {/* Type column */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      file.type === 'directory'
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {file.type === 'directory' ? 'Folder' : 'File'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResults
