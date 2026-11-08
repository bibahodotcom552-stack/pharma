// Cross-platform syntax check: node tests/check_syntax.js
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const files=[...fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js')).map(f=>path.join(root,'js',f)),path.join(root,'sw.js')];
let bad=0;for(const f of files){try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'})}catch(e){bad++;console.log('FAIL',f,'\n',String(e.stderr))}}
console.log(bad?`${bad} file(s) failed`:`PASS (${files.length} files)`);process.exit(bad?1:0);
