# -*- coding: utf-8 -*-
"""装得清白皮书 Word 生成通用库：中文字体、标题、正文、表格、分节页码、脚注注入。"""
import zipfile, shutil, os, re
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
INK = RGBColor(0x1A, 0x1A, 0x17)
HEI = '黑体'
SONG = '宋体'
KAI = '楷体'
ARIAL = 'Arial'

FOOTNOTES = []  # (id, text)

# ---------------- 基础 run / 段落 ----------------
def set_run_font(run, cn=SONG, en=ARIAL, size=12, bold=False, color=INK):
    run.font.name = en
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), en)
    rFonts.set(qn('w:hAnsi'), en)
    rFonts.set(qn('w:eastAsia'), cn)

def para(doc, text='', size=12, cn=SONG, bold=False, align='just', indent_chars=2,
         before=0, after=0, line=1.5, color=INK):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing = line
    amap = {'just': WD_ALIGN_PARAGRAPH.JUSTIFY, 'center': WD_ALIGN_PARAGRAPH.CENTER,
            'left': WD_ALIGN_PARAGRAPH.LEFT, 'right': WD_ALIGN_PARAGRAPH.RIGHT}
    pf.alignment = amap[align]
    if indent_chars:
        pf.first_line_indent = Pt(size * indent_chars)
    if text:
        r = p.add_run(text)
        set_run_font(r, cn=cn, size=size, bold=bold, color=color)
    return p

def h1(doc, text):
    p = doc.add_heading(level=1)
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.5
    r = p.add_run(text)
    set_run_font(r, cn=HEI, size=16, bold=True, color=INK)
    return p

def h2(doc, text):
    p = doc.add_heading(level=2)
    p.paragraph_format.space_before = Pt(11)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.5
    r = p.add_run(text)
    set_run_font(r, cn=HEI, size=14, bold=True, color=INK)
    return p

def h3(doc, text):
    p = doc.add_heading(level=3)
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.5
    r = p.add_run(text)
    set_run_font(r, cn=HEI, size=12, bold=True, color=INK)
    return p

def table_title(doc, text):
    p = para(doc, text, size=10.5, cn=SONG, bold=True, align='center',
             indent_chars=0, before=6, after=4, line=1.3)
    return p

def source_note(doc, text):
    p = para(doc, text, size=9, cn=SONG, align='left', indent_chars=0, after=6, line=1.3,
             color=RGBColor(0x76, 0x76, 0x76))
    return p

def bullet(doc, text, size=12, bold_lead=None):
    """有序/无序条目：用内置 List Bullet 样式；bold_lead 为开头加粗短语。"""
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.line_spacing = 1.5
    p.paragraph_format.space_after = Pt(2)
    if bold_lead:
        r1 = p.add_run(bold_lead)
        set_run_font(r1, cn=SONG, size=size, bold=True)
        r2 = p.add_run(text)
        set_run_font(r2, cn=SONG, size=size)
    else:
        r = p.add_run(text)
        set_run_font(r, cn=SONG, size=size)
    return p

# ---------------- 脚注（生成引用，保存时注入 part） ----------------
def add_footnote(paragraph, text):
    fid = len(FOOTNOTES) + 1
    FOOTNOTES.append((fid, text))
    xml = ('<w:r xmlns:w="%s"><w:rPr><w:vertAlign w:val="superscript"/></w:rPr>'
           '<w:footnoteReference w:id="%d"/></w:r>') % (W, fid)
    paragraph._p.append(etree.fromstring(xml))
    return fid

def para_fn(doc, text, fn_text, **kw):
    """正文段 + 段末脚注。text 中不放编号。"""
    p = para(doc, text, **kw)
    add_footnote(p, fn_text)
    return p

# ---------------- 表格 ----------------
def _shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:fill'), hexcolor)
    tcPr.append(shd)

def _cell_text(cell, text, size=10.5, bold=False, align='left', cn=SONG):
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    p.paragraph_format.line_spacing = 1.25
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.first_line_indent = Pt(0)
    amap = {'left': WD_ALIGN_PARAGRAPH.LEFT, 'center': WD_ALIGN_PARAGRAPH.CENTER,
            'right': WD_ALIGN_PARAGRAPH.RIGHT}
    p.alignment = amap[align]
    # 支持多行（\n）
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if i > 0:
            p = cell.add_paragraph()
            p.paragraph_format.line_spacing = 1.25
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.first_line_indent = Pt(0)
            p.alignment = amap[align]
        r = p.add_run(line)
        set_run_font(r, cn=cn, size=size, bold=bold)

def make_table(doc, headers, rows, widths=None, header_fill='F2F2F2',
               body_align=None, header_size=10.5, body_size=10.5):
    """widths: 列宽 cm 列表；body_align: 每列对齐 list（left/center/right）。"""
    ncol = len(headers)
    t = doc.add_table(rows=1 + len(rows), cols=ncol)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    # 表头
    for j, htext in enumerate(headers):
        c = t.rows[0].cells[j]
        _shade(c, header_fill)
        _cell_text(c, htext, size=header_size, bold=True, align='center', cn=HEI)
    # 数据
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.rows[i + 1].cells[j]
            al = (body_align[j] if body_align else 'left')
            _cell_text(c, str(val), size=body_size, align=al)
    if widths:
        for j, wcm in enumerate(widths):
            for row in t.rows:
                row.cells[j].width = Cm(wcm)
    # 表头跨页重复
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader')
    th.set(qn('w:val'), 'true')
    trPr.append(th)
    # 行不允许跨页断行
    for row in t.rows:
        trPr = row._tr.get_or_add_trPr()
        cant = OxmlElement('w:cantSplit')
        trPr.append(cant)
    return t

# ---------------- 页面 / 分节 / 页码 / 目录 ----------------
def setup_page(doc):
    sec = doc.sections[0]
    sec.page_height = Cm(29.7)
    sec.page_width = Cm(21.0)
    sec.top_margin = Cm(2.5)
    sec.bottom_margin = Cm(2.5)
    sec.left_margin = Cm(2.5)
    sec.right_margin = Cm(2.5)

def _clear_footer(sec):
    sec.footer.is_linked_to_previous = False
    for p in sec.footer.paragraphs:
        p.text = ''

def _page_number_footer(sec, restart=None):
    sec.footer.is_linked_to_previous = False
    p = sec.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Pt(0)
    run = p.add_run()
    fld1 = OxmlElement('w:fldChar'); fld1.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve'); instr.text = ' PAGE '
    fld2 = OxmlElement('w:fldChar'); fld2.set(qn('w:fldCharType'), 'end')
    run._r.append(fld1); run._r.append(instr); run._r.append(fld2)
    set_run_font(run, cn=SONG, size=10.5)
    if restart is not None:
        sectPr = sec._sectPr
        old = sectPr.find(qn('w:pgNumType'))
        if old is not None:
            sectPr.remove(old)
        pg = OxmlElement('w:pgNumType')
        pg.set(qn('w:start'), str(restart))
        sectPr.append(pg)

def add_toc(doc):
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Pt(0)
    run = p.add_run()
    fld1 = OxmlElement('w:fldChar'); fld1.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve')
    instr.text = ' TOC \\o "1-2" \\h \\z \\u '
    fld2 = OxmlElement('w:fldChar'); fld2.set(qn('w:fldCharType'), 'separate')
    tip = OxmlElement('w:t'); tip.text = '（打开文档后右键“更新域”即可生成目录）'
    fld3 = OxmlElement('w:fldChar'); fld3.set(qn('w:fldCharType'), 'end')
    run._r.append(fld1); run._r.append(instr); run._r.append(fld2)
    r2 = p.add_run(); r2._r.append(tip); set_run_font(r2, size=10.5, color=RGBColor(0x76,0x76,0x76))
    run3 = p.add_run(); run3._r.append(fld3)
    return p

def page_break(doc):
    from docx.enum.text import WD_BREAK
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Pt(0)
    p.add_run().add_break(WD_BREAK.PAGE)

# ---------------- 样式初始化 ----------------
def init_styles(doc):
    styles = doc.styles
    normal = styles['Normal']
    normal.font.name = ARIAL
    normal.font.size = Pt(12)
    normal.font.color.rgb = INK
    rPr = normal.element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), ARIAL); rFonts.set(qn('w:hAnsi'), ARIAL)
    rFonts.set(qn('w:eastAsia'), SONG)
    # List Bullet 中文字体
    try:
        lb = styles['List Bullet']
        lb.font.size = Pt(12)
        rPr2 = lb.element.get_or_add_rPr()
        rf2 = rPr2.find(qn('w:rFonts'))
        if rf2 is None:
            rf2 = OxmlElement('w:rFonts'); rPr2.append(rf2)
        rf2.set(qn('w:eastAsia'), SONG)
        lb.font.color.rgb = INK
    except KeyError:
        pass
    # 标题样式颜色重置为黑色（避免主题蓝）
    for lvl, sz in [(1, 16), (2, 14), (3, 12)]:
        st = styles['Heading %d' % lvl]
        st.font.color.rgb = INK
        st.font.size = Pt(sz)
        st.font.bold = True
        rp = st.element.get_or_add_rPr()
        rf = rp.find(qn('w:rFonts'))
        if rf is None:
            rf = OxmlElement('w:rFonts'); rp.append(rf)
        rf.set(qn('w:eastAsia'), HEI); rf.set(qn('w:ascii'), ARIAL); rf.set(qn('w:hAnsi'), ARIAL)

# ---------------- 保存后注入 footnotes part ----------------
def enable_update_fields(docx_path):
    """在 settings.xml 注入 updateFields，Word 打开时自动刷新目录等域。"""
    tmp = docx_path + '.tmp'
    with zipfile.ZipFile(docx_path, 'r') as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}
    sp = 'word/settings.xml'
    if sp in data:
        s = data[sp].decode('utf-8')
        if 'updateFields' not in s:
            s = re.sub(r'(<w:settings[^>]*>)',
                       r'\1<w:updateFields w:val="true"/>', s, count=1)
            data[sp] = s.encode('utf-8')
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
    shutil.move(tmp, docx_path)

def inject_footnotes(docx_path):
    if not FOOTNOTES:
        return
    tmp = docx_path + '.tmp'
    fn_items = [
        '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>',
        '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>',
    ]
    def esc(s):
        return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    for fid, text in FOOTNOTES:
        fn_items.append(
            '<w:footnote w:id="%d"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>'
            '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r>'
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="%s"/><w:sz w:val="18"/></w:rPr>'
            '<w:t xml:space="preserve"> %s</w:t></w:r></w:p></w:footnote>' % (fid, SONG, esc(text)))
    fn_xml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<w:footnotes xmlns:w="%s">%s</w:footnotes>') % (W, ''.join(fn_items))

    with zipfile.ZipFile(docx_path, 'r') as zin:
        names = zin.namelist()
        data = {n: zin.read(n) for n in names}

    # 1) content types
    ct = data['[Content_Types].xml'].decode('utf-8')
    if 'footnotes+xml' not in ct:
        ct = ct.replace('</Types>',
            '<Override PartName="/word/footnotes.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>')
        data['[Content_Types].xml'] = ct.encode('utf-8')
    # 2) document rels
    rels_path = 'word/_rels/document.xml.rels'
    rels = data[rels_path].decode('utf-8')
    if 'footnotes.xml' not in rels:
        ids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels)]
        newid = 'rId%d' % (max(ids) + 1 if ids else 100)
        rels = rels.replace('</Relationships>',
            '<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>' % newid)
        data[rels_path] = rels.encode('utf-8')
    # 3) footnotes part
    data['word/footnotes.xml'] = fn_xml.encode('utf-8')

    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zout.writestr(n, data[n])
        if 'word/footnotes.xml' not in names:
            zout.writestr('word/footnotes.xml', data['word/footnotes.xml'])
    shutil.move(tmp, docx_path)
