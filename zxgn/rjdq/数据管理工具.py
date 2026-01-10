import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
import os
import json
import datetime
import shutil

class SoftwareDataManager:
    def __init__(self, data_file="software_data.txt", backup_dir="backups"):
        self.data_file = data_file
        self.backup_dir = backup_dir
        self.software_list = []
        
        # 创建备份目录
        os.makedirs(self.backup_dir, exist_ok=True)
        
        self.load_data()
    
    def load_data(self):
        self.software_list = []
        
        if not os.path.exists(self.data_file):
            messagebox.showwarning("警告", f"数据文件 '{self.data_file}' 不存在，已创建空列表")
            return
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as file:
                for line in file:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        parts = line.split('|')
                        if len(parts) == 4:
                            software = {
                                'id': int(parts[0].strip()),
                                'name': parts[1].strip(),
                                'url': parts[2].strip(),
                                'time': parts[3].strip()
                            }
                            self.software_list.append(software)
        except Exception as e:
            messagebox.showerror("错误", f"加载数据时出错: {e}")
    
    def get_new_id(self):
        if not self.software_list:
            return 1
        max_id = max(software['id'] for software in self.software_list)
        return max_id + 1
    
    def add_software(self, name, url, time=None):
        if not time:
            time = datetime.datetime.now().strftime("%Y-%m-%d")
        
        new_id = self.get_new_id()
        software = {
            'id': new_id,
            'name': name,
            'url': url,
            'time': time
        }
        self.software_list.append(software)
        return new_id
    
    def delete_software(self, software_id):
        for i, software in enumerate(self.software_list):
            if software['id'] == software_id:
                del self.software_list[i]
                return True
        return False
    
    def update_software(self, software_id, name=None, url=None, time=None):
        for software in self.software_list:
            if software['id'] == software_id:
                if name:
                    software['name'] = name
                if url:
                    software['url'] = url
                if time:
                    software['time'] = time
                return True
        return False
    
    def search_software(self, keyword):
        results = []
        keyword = keyword.lower()
        for software in self.software_list:
            if (keyword in software['name'].lower() or 
                keyword in software['url'].lower() or 
                keyword in str(software['id'])):
                results.append(software)
        return results
    
    def export_to_txt(self, filename):
        try:
            with open(filename, 'w', encoding='utf-8') as file:
                for software in self.software_list:
                    line = f"{software['id']}|{software['name']}|{software['url']}|{software['time']}\n"
                    file.write(line)
            return True
        except Exception as e:
            messagebox.showerror("错误", f"导出时出错: {e}")
            return False
    
    def export_to_json(self, filename):
        try:
            with open(filename, 'w', encoding='utf-8') as file:
                json.dump({
                    'export_time': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'count': len(self.software_list),
                    'software': self.software_list
                }, file, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            messagebox.showerror("错误", f"导出到JSON时出错: {e}")
            return False
    
    def create_backup(self):
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(self.backup_dir, f"software_data_backup_{timestamp}.txt")
        
        try:
            shutil.copy2(self.data_file, backup_file)
            return True, backup_file
        except Exception as e:
            return False, str(e)

class SoftwareManagerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("软件数据管理系统")
        self.root.geometry("1000x700")
        
        # 设置样式
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # 创建管理器实例
        self.manager = SoftwareDataManager("software_data.txt")
        
        # 创建主界面
        self.create_widgets()
        self.refresh_table()
    
    def create_widgets(self):
        # 顶部按钮区域
        button_frame = ttk.Frame(self.root)
        button_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Button(button_frame, text="添加软件", command=self.add_software).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="编辑软件", command=self.edit_software).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="删除软件", command=self.delete_software).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="搜索软件", command=self.search_software).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="导出TXT", command=self.export_txt).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="导出JSON", command=self.export_json).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="创建备份", command=self.create_backup).pack(side=tk.LEFT, padx=2)
        ttk.Button(button_frame, text="刷新列表", command=self.refresh_table).pack(side=tk.LEFT, padx=2)
        
        # 搜索框
        search_frame = ttk.Frame(self.root)
        search_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(search_frame, text="搜索:").pack(side=tk.LEFT, padx=5)
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(search_frame, textvariable=self.search_var, width=30)
        search_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(search_frame, text="搜索", command=self.search_software).pack(side=tk.LEFT, padx=5)
        ttk.Button(search_frame, text="清除", command=self.clear_search).pack(side=tk.LEFT, padx=5)
        
        # 表格区域
        table_frame = ttk.Frame(self.root)
        table_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # 创建表格
        columns = ('ID', '软件名称', 'URL', '更新时间')
        self.tree = ttk.Treeview(table_frame, columns=columns, show='headings', height=20)
        
        # 设置列标题
        for col in columns:
            self.tree.heading(col, text=col)
            if col == 'ID':
                self.tree.column(col, width=50, anchor=tk.CENTER)
            elif col == '软件名称':
                self.tree.column(col, width=200)
            elif col == 'URL':
                self.tree.column(col, width=400)
            else:
                self.tree.column(col, width=100, anchor=tk.CENTER)
        
        # 添加滚动条
        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 状态栏
        self.status_var = tk.StringVar()
        self.status_var.set("就绪")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        # 绑定双击事件
        self.tree.bind('<Double-Button-1>', self.on_double_click)
    
    def refresh_table(self, software_list=None):
        """刷新表格显示"""
        # 清除当前显示
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # 获取要显示的数据
        if software_list is None:
            software_list = self.manager.software_list
        
        # 添加数据到表格
        for software in software_list:
            self.tree.insert('', 'end', values=(
                software['id'],
                software['name'],
                software['url'],
                software['time']
            ))
        
        # 更新状态栏
        self.status_var.set(f"共 {len(software_list)} 个软件")
    
    def add_software(self):
        """添加软件对话框"""
        dialog = tk.Toplevel(self.root)
        dialog.title("添加新软件")
        dialog.geometry("500x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 居中显示
        dialog.update_idletasks()
        width = dialog.winfo_width()
        height = dialog.winfo_height()
        x = (dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (dialog.winfo_screenheight() // 2) - (height // 2)
        dialog.geometry(f'{width}x{height}+{x}+{y}')
        
        # 创建表单
        form_frame = ttk.Frame(dialog, padding="20")
        form_frame.pack(fill=tk.BOTH, expand=True)
        
        # 软件名称
        ttk.Label(form_frame, text="软件名称:").grid(row=0, column=0, sticky=tk.W, pady=5)
        name_var = tk.StringVar()
        name_entry = ttk.Entry(form_frame, textvariable=name_var, width=40)
        name_entry.grid(row=0, column=1, pady=5, padx=10)
        
        # URL
        ttk.Label(form_frame, text="URL/文件路径:").grid(row=1, column=0, sticky=tk.W, pady=5)
        url_var = tk.StringVar()
        url_entry = ttk.Entry(form_frame, textvariable=url_var, width=40)
        url_entry.grid(row=1, column=1, pady=5, padx=10)
        
        # 更新时间
        ttk.Label(form_frame, text="更新时间:").grid(row=2, column=0, sticky=tk.W, pady=5)
        time_var = tk.StringVar(value=datetime.datetime.now().strftime("%Y-%m-%d"))
        time_entry = ttk.Entry(form_frame, textvariable=time_var, width=40)
        time_entry.grid(row=2, column=1, pady=5, padx=10)
        
        # 按钮区域
        button_frame = ttk.Frame(form_frame)
        button_frame.grid(row=3, column=0, columnspan=2, pady=20)
        
        def save_software():
            name = name_var.get().strip()
            url = url_var.get().strip()
            time = time_var.get().strip()
            
            if not name:
                messagebox.showerror("错误", "软件名称不能为空！")
                return
            
            if not url:
                messagebox.showerror("错误", "URL不能为空！")
                return
            
            if not time:
                time = datetime.datetime.now().strftime("%Y-%m-%d")
            
            new_id = self.manager.add_software(name, url, time)
            messagebox.showinfo("成功", f"软件添加成功！\nID: {new_id}")
            self.refresh_table()
            dialog.destroy()
        
        ttk.Button(button_frame, text="保存", command=save_software).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
        
        name_entry.focus()
    
    def edit_software(self):
        """编辑软件对话框"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要编辑的软件")
            return
        
        # 获取选中的软件ID
        item = selection[0]
        values = self.tree.item(item, 'values')
        software_id = int(values[0])
        
        # 查找软件数据
        software = None
        for s in self.manager.software_list:
            if s['id'] == software_id:
                software = s
                break
        
        if not software:
            messagebox.showerror("错误", "找不到选中的软件")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("编辑软件")
        dialog.geometry("500x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 居中显示
        dialog.update_idletasks()
        width = dialog.winfo_width()
        height = dialog.winfo_height()
        x = (dialog.winfo_screenwidth() // 2) - (width // 2)
        y = (dialog.winfo_screenheight() // 2) - (height // 2)
        dialog.geometry(f'{width}x{height}+{x}+{y}')
        
        # 创建表单
        form_frame = ttk.Frame(dialog, padding="20")
        form_frame.pack(fill=tk.BOTH, expand=True)
        
        # 软件ID（不可编辑）
        ttk.Label(form_frame, text="软件ID:").grid(row=0, column=0, sticky=tk.W, pady=5)
        ttk.Label(form_frame, text=str(software['id'])).grid(row=0, column=1, sticky=tk.W, pady=5, padx=10)
        
        # 软件名称
        ttk.Label(form_frame, text="软件名称:").grid(row=1, column=0, sticky=tk.W, pady=5)
        name_var = tk.StringVar(value=software['name'])
        name_entry = ttk.Entry(form_frame, textvariable=name_var, width=40)
        name_entry.grid(row=1, column=1, pady=5, padx=10)
        
        # URL
        ttk.Label(form_frame, text="URL/文件路径:").grid(row=2, column=0, sticky=tk.W, pady=5)
        url_var = tk.StringVar(value=software['url'])
        url_entry = ttk.Entry(form_frame, textvariable=url_var, width=40)
        url_entry.grid(row=2, column=1, pady=5, padx=10)
        
        # 更新时间
        ttk.Label(form_frame, text="更新时间:").grid(row=3, column=0, sticky=tk.W, pady=5)
        time_var = tk.StringVar(value=software['time'])
        time_entry = ttk.Entry(form_frame, textvariable=time_var, width=40)
        time_entry.grid(row=3, column=1, pady=5, padx=10)
        
        # 按钮区域
        button_frame = ttk.Frame(form_frame)
        button_frame.grid(row=4, column=0, columnspan=2, pady=20)
        
        def save_changes():
            name = name_var.get().strip()
            url = url_var.get().strip()
            time = time_var.get().strip()
            
            if not name:
                messagebox.showerror("错误", "软件名称不能为空！")
                return
            
            if not url:
                messagebox.showerror("错误", "URL不能为空！")
                return
            
            if self.manager.update_software(software_id, name, url, time):
                messagebox.showinfo("成功", "软件信息更新成功！")
                self.refresh_table()
                dialog.destroy()
            else:
                messagebox.showerror("错误", "更新失败！")
        
        ttk.Button(button_frame, text="保存", command=save_changes).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
        
        name_entry.focus()
        name_entry.select_range(0, tk.END)
    
    def delete_software(self):
        """删除软件"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要删除的软件")
            return
        
        item = selection[0]
        values = self.tree.item(item, 'values')
        software_id = int(values[0])
        software_name = values[1]
        
        # 确认删除
        if messagebox.askyesno("确认删除", f"确定要删除软件 '{software_name}' (ID: {software_id}) 吗？"):
            if self.manager.delete_software(software_id):
                messagebox.showinfo("成功", "软件删除成功！")
                self.refresh_table()
            else:
                messagebox.showerror("错误", "删除失败！")
    
    def search_software(self):
        """搜索软件"""
        keyword = self.search_var.get().strip()
        if not keyword:
            messagebox.showwarning("警告", "请输入搜索关键词")
            return
        
        results = self.manager.search_software(keyword)
        self.refresh_table(results)
        self.status_var.set(f"搜索到 {len(results)} 个结果（关键词: '{keyword}'）")
    
    def clear_search(self):
        """清除搜索"""
        self.search_var.set("")
        self.refresh_table()
    
    def export_txt(self):
        """导出为TXT文件"""
        if not self.manager.software_list:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("文本文件", "*.txt"), ("所有文件", "*.*")],
            initialfile=f"software_data_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        )
        
        if filename:
            if self.manager.export_to_txt(filename):
                messagebox.showinfo("成功", f"数据已导出到:\n{filename}")
    
    def export_json(self):
        """导出为JSON文件"""
        if not self.manager.software_list:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")],
            initialfile=f"software_data_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        if filename:
            if self.manager.export_to_json(filename):
                messagebox.showinfo("成功", f"数据已导出到:\n{filename}")
    
    def create_backup(self):
        """创建备份"""
        if not os.path.exists(self.manager.data_file):
            messagebox.showwarning("警告", "原始数据文件不存在，无法创建备份")
            return
        
        success, result = self.manager.create_backup()
        if success:
            messagebox.showinfo("成功", f"备份创建成功！\n保存到: {result}")
        else:
            messagebox.showerror("错误", f"备份创建失败:\n{result}")
    
    def on_double_click(self, event):
        """双击事件 - 编辑软件"""
        self.edit_software()

def main():
    root = tk.Tk()
    app = SoftwareManagerGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()