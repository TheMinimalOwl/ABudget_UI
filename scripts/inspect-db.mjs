import Database from 'better-sqlite3';

const db = new Database('.data/My-Finances-4050050/db.sqlite', {
  readonly: true,
  fileMustExist: true,
});

const cols = db.prepare('pragma table_info(transactions)').all();
console.log('COLUMNAS:', cols.map(c => `${c.name}:${c.type}`).join(', '));

const q = (sql) => db.prepare(sql).get();
console.log('vivas:', q('select count(*) n from transactions where tombstone = 0'));
console.log('padres (isParent=1):', q('select count(*) n from transactions where tombstone = 0 and isParent = 1'));
console.log('hijas (isChild=1):', q('select count(*) n from transactions where tombstone = 0 and isChild = 1'));
console.log('con parent_id:', q('select count(*) n from transactions where tombstone = 0 and parent_id is not null'));
console.log('con acct null:', q('select count(*) n from transactions where tombstone = 0 and acct is null'));
console.log('con category null:', q('select count(*) n from transactions where tombstone = 0 and category is null'));
console.log(
  'transfer_id no null:',
  q('select count(*) n from transactions where tombstone = 0 and transferred_id is not null'),
);
console.log('rango:', q('select min(date) a, max(date) b from transactions where tombstone = 0'));

console.log('\nPor mes:');
for (const r of db
  .prepare(
    "select substr(date,1,6) m, count(*) n from transactions where tombstone = 0 group by m order by m",
  )
  .all()) {
  console.log(r);
}
