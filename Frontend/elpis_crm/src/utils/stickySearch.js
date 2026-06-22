const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'pages');

['Accounts', 'Contacts'].forEach(name => {
  const filePath = path.join(base, name + '.js');
  let c = fs.readFileSync(filePath, 'utf8');

  const placeholder = name === 'Accounts'
    ? 'Search accounts by name, phone, city, country...'
    : 'Search contacts by name, email, phone...';

  const tableComment = name === 'Accounts'
    ? '{/* Accounts Table with Sticky Pagination */}'
    : '{/* Contacts Table with Sticky Pagination */}';

  const tableDiv = name === 'Accounts'
    ? '      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">'
    : '      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">';

  const scrollDiv = name === 'Accounts'
    ? '        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">'
    : '        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">';

  // 1. Remove the old standalone search bar div (before the table)
  const oldSearchBar = `      {/* Search Filter Bar */}
      <div className="w-full mb-3 flex items-center justify-end gap-3">

        <SearchBar
          value={localSearch}
          onChange={setLocalSearch}

          placeholder="${placeholder}"
          className="max-w-md"

        />

        {localSearch && (
          <span className="text-xs text-gray-500 whitespace-nowrap">

            Results for "<span className="font-medium text-gray-700">{localSearch}</span>"

          </span>
        )}
      </div>

            ${tableComment}`;

  // New: search bar is sticky inside the table container
  const newLayout = `      ${tableComment}
      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">
        {/* Sticky Search Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-end gap-3">
          {localSearch && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Results for "<span className="font-medium text-gray-700">{localSearch}</span>"
            </span>
          )}
          <SearchBar
            value={localSearch}
            onChange={setLocalSearch}
            placeholder="${placeholder}"
            className="max-w-xs"
          />
        </div>`;

  if (c.includes(oldSearchBar)) {
    // Replace old search bar + table opening div with new layout
    c = c.replace(
      oldSearchBar + '\n' + tableDiv,
      newLayout
    );
    // Remove the duplicate table div that follows
    console.log(name + '.js: search bar moved to sticky (full match)');
  } else {
    // Fallback: find search bar start and table div separately
    const searchStart = c.indexOf('{/* Search Filter Bar */}');
    const tableStart = c.indexOf(tableComment);

    if (searchStart !== -1 && tableStart !== -1) {
      // Remove everything from search bar to table comment
      const before = c.substring(0, searchStart);
      const after = c.substring(tableStart);

      // Replace table opening with sticky search bar inside
      const newAfter = after.replace(
        tableDiv + '\n        ' + scrollDiv,
        `${tableComment}
      <div className="w-full flex flex-col rounded-xl border border-gray-200 shadow-sm bg-white flex-1 min-h-0">
        {/* Sticky Search Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-end gap-3">
          {localSearch && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Results for "<span className="font-medium text-gray-700">{localSearch}</span>"
            </span>
          )}
          <SearchBar
            value={localSearch}
            onChange={setLocalSearch}
            placeholder="${placeholder}"
            className="max-w-xs"
          />
        </div>
        ${scrollDiv}`
      );

      c = before + newAfter;
      console.log(name + '.js: search bar moved to sticky (fallback)');
    } else {
      console.log(name + '.js: SKIP - markers not found searchStart=' + searchStart + ' tableStart=' + tableStart);
    }
  }

  fs.writeFileSync(filePath, c, 'utf8');
});
