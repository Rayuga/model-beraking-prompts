from pathlib import Path
from xml.etree import ElementTree as ET
import zipfile
HERE = Path(__file__).resolve().parent
TEMPLATES = {
    "eval": Path("C:/Users/00518507/Downloads/EVAL-REPORT-drawbill-progress-desk.docx"),
    "case": Path("C:/Users/00518507/Downloads/CASE-STUDY-drawbill-progress-desk.docx"),
}

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
DOCREL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace("w", NS)
ET.register_namespace("r", DOCREL)
def w(tag):
    return "{" + NS + "}" + tag


class Report:
    def __init__(self, title, kind):
        self.title, self.kind = title, kind
        self.root = ET.Element(w("document"))
        self.body = ET.SubElement(self.root, w("body"))
        self.plain = []

    def paragraph(self, text, style=None, size=None, bold=False, color=None, parent=None):
        p = ET.SubElement(parent if parent is not None else self.body, w("p"))
        pr = ET.SubElement(p, w("pPr"))
        if style:
            ET.SubElement(pr, w("pStyle"), {w("val"): style})
        ET.SubElement(pr, w("spacing"), {w("after"): "95", w("line"): "250", w("lineRule"): "auto"})
        if style and ("Heading" in style or style == "Title"):
            ET.SubElement(pr, w("keepNext"))
        run = ET.SubElement(p, w("r"))
        rp = ET.SubElement(run, w("rPr"))
        if size:
            ET.SubElement(rp, w("sz"), {w("val"): str(size)})
        if bold:
            ET.SubElement(rp, w("b"))
        if color:
            ET.SubElement(rp, w("color"), {w("val"): color})
        for i, chunk in enumerate(str(text).split("\n")):
            if i:
                ET.SubElement(run, w("br"))
            t = ET.SubElement(run, w("t"), {"{http://www.w3.org/XML/1998/namespace}space": "preserve"})
            t.text = chunk
        self.plain.append(str(text))
        return p

    def heading(self, text, level=1):
        self.paragraph(text, f"Heading{level}")

    def bullet(self, text):
        self.paragraph(text, "ListBullet")

    def page_break(self):
        p = ET.SubElement(self.body, w("p"))
        ET.SubElement(ET.SubElement(p, w("r")), w("br"), {w("type"): "page"})

    def table(self, headers, rows, widths=None, size=17):
        widths = widths or [10440 // len(headers)] * len(headers)
        tbl = ET.SubElement(self.body, w("tbl"))
        props = ET.SubElement(tbl, w("tblPr"))
        ET.SubElement(props, w("tblW"), {w("w"): "10440", w("type"): "dxa"})
        ET.SubElement(props, w("tblLayout"), {w("type"): "fixed"})
        margins = ET.SubElement(props, w("tblCellMar"))
        for side in ["top", "bottom", "left", "right"]:
            ET.SubElement(margins, w(side), {w("w"): "70", w("type"): "dxa"})
        borders = ET.SubElement(props, w("tblBorders"))
        for side in ["top", "left", "bottom", "right", "insideH", "insideV"]:
            ET.SubElement(borders, w(side), {w("val"): "single", w("sz"): "4", w("color"): "D8E2EE"})
        grid = ET.SubElement(tbl, w("tblGrid"))
        for width in widths:
            ET.SubElement(grid, w("gridCol"), {w("w"): str(width)})
        for ri, row in enumerate([headers] + list(rows)):
            tr = ET.SubElement(tbl, w("tr"))
            trpr = ET.SubElement(tr, w("trPr"))
            ET.SubElement(trpr, w("cantSplit"))
            if ri == 0:
                ET.SubElement(trpr, w("tblHeader"))
            for ci, value in enumerate(row):
                tc = ET.SubElement(tr, w("tc"))
                tcp = ET.SubElement(tc, w("tcPr"))
                ET.SubElement(tcp, w("tcW"), {w("w"): str(widths[ci]), w("type"): "dxa"})
                ET.SubElement(tcp, w("vAlign"), {w("val"): "center"})
                if ri == 0 or ri % 2 == 0:
                    ET.SubElement(tcp, w("shd"), {w("fill"): "17365D" if ri == 0 else "F2F6FA"})
                self.paragraph(value, size=size, bold=ri == 0, color="FFFFFF" if ri == 0 else "1D2733", parent=tc)
        self.paragraph("")

    def save(self, path):
        section = ET.SubElement(self.body, w("sectPr"))
        ET.SubElement(section, w("pgSz"), {w("w"): "12240", w("h"): "15840"})
        ET.SubElement(section, w("pgMar"), {w("top"): "850", w("right"): "900", w("bottom"): "850", w("left"): "900", w("header"): "400", w("footer"): "400", w("gutter"): "0"})
        doc = ET.tostring(self.root, encoding="utf-8", xml_declaration=True)
        with zipfile.ZipFile(TEMPLATES[self.kind]) as source:
            parts = {n: source.read(n) for n in ["word/styles.xml", "word/numbering.xml", "word/fontTable.xml", "word/theme/theme1.xml"]}
        styles = ET.fromstring(parts["word/styles.xml"])
        styles.attrib.pop("{http://schemas.openxmlformats.org/markup-compatibility/2006}Ignorable", None)
        normal = styles.find(f"{w('style')}[@{w('styleId')}='Normal']")
        if normal is not None:
            rp = normal.find(w("rPr"))
            if rp is None:
                rp = ET.SubElement(normal, w("rPr"))
            for key, attrs in [("sz", {w("val"): "20"}), ("rFonts", {w("ascii"): "Calibri", w("hAnsi"): "Calibri"})]:
                e = rp.find(w(key))
                if e is None:
                    e = ET.SubElement(rp, w(key))
                e.attrib.update(attrs)
        parts["word/styles.xml"] = ET.tostring(styles, encoding="utf-8", xml_declaration=True)
        parts["word/document.xml"] = doc
        settings = ET.Element(w("settings"))
        ET.SubElement(settings, w("defaultTabStop"), {w("val"): "720"})
        parts["word/settings.xml"] = ET.tostring(settings, encoding="utf-8", xml_declaration=True)
        rels = ET.Element("Relationships", xmlns=REL)
        for i, (typ, target) in enumerate([("styles", "styles.xml"), ("numbering", "numbering.xml"), ("fontTable", "fontTable.xml"), ("theme", "theme/theme1.xml"), ("settings", "settings.xml")], 1):
            ET.SubElement(rels, "Relationship", Id=f"rId{i}", Type=DOCREL + "/" + typ, Target=target)
        parts["word/_rels/document.xml.rels"] = ET.tostring(rels, encoding="utf-8", xml_declaration=True)
        package_rels = ET.Element("Relationships", xmlns=REL)
        ET.SubElement(package_rels, "Relationship", Id="rId1", Type=DOCREL + "/officeDocument", Target="word/document.xml")
        ET.SubElement(package_rels, "Relationship", Id="rId2", Type=REL + "/metadata/core-properties", Target="docProps/core.xml")
        parts["_rels/.rels"] = ET.tostring(package_rels, encoding="utf-8", xml_declaration=True)
        core = ET.Element("{http://schemas.openxmlformats.org/package/2006/metadata/core-properties}coreProperties")
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}title").text = self.title
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}creator").text = "Dropline task delivery"
        ET.SubElement(core, "{http://purl.org/dc/elements/1.1/}description").text = "Recorded platform run results; prepared 14 September 2026. Completed Oracle, GPT-mini, Gemini and Haiku exports."
        parts["docProps/core.xml"] = ET.tostring(core, encoding="utf-8", xml_declaration=True)
        types = ET.Element("Types", xmlns="http://schemas.openxmlformats.org/package/2006/content-types")
        ET.SubElement(types, "Default", Extension="rels", ContentType="application/vnd.openxmlformats-package.relationships+xml")
        ET.SubElement(types, "Default", Extension="xml", ContentType="application/xml")
        for name, suffix in [("word/document.xml", "wordprocessingml.document.main+xml"), ("word/styles.xml", "wordprocessingml.styles+xml"), ("word/numbering.xml", "wordprocessingml.numbering+xml"), ("word/settings.xml", "wordprocessingml.settings+xml"), ("word/fontTable.xml", "wordprocessingml.fontTable+xml"), ("word/theme/theme1.xml", "theme+xml")]:
            ET.SubElement(types, "Override", PartName="/" + name, ContentType="application/vnd.openxmlformats-officedocument." + suffix)
        ET.SubElement(types, "Override", PartName="/docProps/core.xml", ContentType="application/vnd.openxmlformats-package.core-properties+xml")
        parts["[Content_Types].xml"] = ET.tostring(types, encoding="utf-8", xml_declaration=True)
        with zipfile.ZipFile(path, "x", zipfile.ZIP_DEFLATED) as z:
            for name, data in parts.items():
                z.writestr(name, data)
        (HERE / (path.stem + ".txt")).write_text("\n".join(self.plain), encoding="utf-8")
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            for n in z.namelist():
                if n.endswith((".xml", ".rels")):
                    ET.fromstring(z.read(n))
            text = " ".join(t.text or "" for t in ET.fromstring(z.read("word/document.xml")).iter(w("t")))
            assert "DrawBill" not in text and "drawbill" not in text
            assert "0.9917" in text and "0.1766" in text and "0.7804" in text
