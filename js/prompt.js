// AI instructions + JSON schema. Tune reading rules here.
/* ================= GEMINI ================= */
const list=(a)=>a.map((d,i)=>`${i+1}. ${d}`).join('\n');
const BASE = `You are auditing a photo of ONE HALF of a handwritten "Daily Consumption" pharmacy register sheet (IRC template).
The photo may be rotated, sideways or upside-down — mentally rotate it so the printed headers read upright. Black rectangles are privacy masks; ignore them.
Each sheet has data rows numbered SL 1 to 38. Drug columns have printed headers.

HALF A printed columns (left to right):
${list(HALF_A)}

HALF B printed columns (left to right):
${list(HALF_B)}
After column 47 of HALF B there are blank-header columns where staff HANDWRITE extra/substituted drug names (e.g. "Famotidine 20mg"). Handwritten drug names may also appear in the bottom margin.

RULES FOR QUANTITIES:
- A cell value is a handwritten number (e.g. 1, 2, 5, 6, 7, 10, 14, 15, 20, 21, 30, 60).
- A single vertical stroke "|" or "1" in a drug cell = quantity 1 (bottles, tubes, inhalers).
- IGNORE: dots ".", tiny tick marks or specks, marks next to the SL row numbers, crossed-out scribbles with no number, and the printed SL numbers themselves.
- Two numbers stacked in one cell (e.g. "15" over "10") are TWO entries for consecutive rows — trace each to its own row line.
- Trace every number straight up its grid column to the printed header; handwriting often spills over grid lines — assign to the column where most of the digit sits. If unsure, give best guess and confident=false.
- If a number is overwritten or ambiguous (e.g. 1 vs 7, 4 vs 9, 6 vs 0), give best reading, put what you see in "raw", confident=false.
- Ignore the bottom stock rows (BALANCE / NEW STOCK / TOTAL / STOCK BALANCE) unless filled — then mention in notes.
DATE: on HALF A the register date is handwritten in the printed "SL NO / Date" box at the top-left, above the names column (e.g. "29-06-26"). Copy it into sheet_date exactly as written (day first). If no date is visible, leave sheet_date empty. Never guess a date.
PRIVACY: NEVER output patient names, P/NO numbers or any personal information. Output only drug columns, row numbers and quantities.`;

const PASS_TXT = [
 `METHOD: Work ROW BY ROW. For SL row 1, scan left→right across all columns and list every non-empty drug cell; then row 2 … up to row 38.`,
 `METHOD: Work COLUMN BY COLUMN. For printed column 1, scan top→bottom through rows 1–38 and list every non-empty cell; then column 2 … to the last column, then the handwritten extra columns.`
];

const SCHEMA = {type:"OBJECT",properties:{
  half:{type:"STRING",enum:["A","B"]},
  entries:{type:"ARRAY",items:{type:"OBJECT",properties:{
    row:{type:"INTEGER"},
    col:{type:"INTEGER",description:"printed column number in this half; 0 for a handwritten extra column"},
    extra_name:{type:"STRING",description:"for col=0 only: interpreted generic name + strength of the handwritten column, else empty"},
    qty:{type:"NUMBER"},
    raw:{type:"STRING"},
    confident:{type:"BOOLEAN"}},required:["row","col","qty","confident"]}},
  extra_columns:{type:"ARRAY",items:{type:"OBJECT",properties:{as_written:{type:"STRING"},interpreted:{type:"STRING"}}}},
  sheet_date:{type:"STRING",description:"register date as written on the sheet, day first; empty if none visible"},
  notes:{type:"ARRAY",items:{type:"STRING"}}
},required:["half","entries"]};

// 3rd reading ("tie-break"): only the cells where the 2 readings disagreed or the AI was unsure.
const tbText = (half,list) => `TIE-BREAK CHECK of half ${half}. Two earlier readings of this photo disagreed on the cells below.
Look ONLY at these cells. For each one: find the printed header of the column, go straight down that column to SL row R,
and give the number written in that cell (qty 0 if the cell is empty). The photo is upright.
${list.map((c,i)=>`${i+1}. SL row ${c.row} — ${c.col?`printed column ${c.col} "${c.label}"`:`handwritten extra column "${c.label}"`}`).join(String.fromCharCode(10))}`;
const TB_SCHEMA = {type:"OBJECT",properties:{cells:{type:"ARRAY",items:{type:"OBJECT",properties:{
  n:{type:"INTEGER",description:"number of the cell in the list"},qty:{type:"NUMBER"},confident:{type:"BOOLEAN"}},required:["n","qty","confident"]}}},required:["cells"]};
