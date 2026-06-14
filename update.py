import re
with open('src/pages/admin/OvertimeManagement.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add ArrowUpDown
content = content.replace(
    "import { Download, Plus, Trash2, Timer, RefreshCw } from 'lucide-react';",
    "import { Download, Plus, Trash2, Timer, RefreshCw, ArrowUpDown } from 'lucide-react';"
)

# Add state
content = content.replace(
    "const [selectedIds, setSelectedIds] = useState<string[]>([]);",
    "const [selectedIds, setSelectedIds] = useState<string[]>([]);\n  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);"
)

# Add logic before return
logic = '''
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    if (sortConfig.key === 'name') {
      const nameA = a.personnel ? ${a.personnel.first_name} .toLowerCase() : '';
      const nameB = b.personnel ? ${b.personnel.first_name} .toLowerCase() : '';
      if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
    if (sortConfig.key === 'date') {
      const dateA = new Date(a.record_date).getTime();
      const dateB = new Date(b.record_date).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });

  return (
'''
content = content.replace("  return (", logic, 1)

# Modify TableHead
content = content.replace("<TableHead>Personel</TableHead>", '''<TableHead className="cursor-pointer hover:bg-secondary/20 group" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      Personel <ArrowUpDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </TableHead>''')

content = content.replace("<TableHead>Tarih</TableHead>", '''<TableHead className="cursor-pointer hover:bg-secondary/20 group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      Tarih <ArrowUpDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </TableHead>''')

content = content.replace(
    "records.map((r: any) => (",
    "sortedRecords.map((r: any) => ("
)

content = content.replace(
    "records.length === 0 ?",
    "sortedRecords.length === 0 ?"
)

with open('src/pages/admin/OvertimeManagement.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
