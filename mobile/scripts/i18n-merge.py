# Ajoute un lot de traductions { "texte français": ["anglais", "arabe"] } aux dictionnaires de l'appli.
# Usage : python3 scripts/i18n-merge.py scripts/i18n-batch.json
import json, re, sys, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'i18n')
en = json.load(open(f'{root}/en.json')); ar = json.load(open(f'{root}/ar.json'))
for path in sys.argv[1:]:
    for k, (e, a) in json.load(open(path)).items():
        for t in (e, a):
            for ph in re.findall(r'\{\d+\}', t):
                assert ph in k, (k, t)
        en[k] = e; ar[k] = a
# La marque reste écrite en lettres latines, comme dans le logo.
ar = {k: v.replace('نيسالي', 'Nissali') for k, v in ar.items()}
for name, d in (('en', en), ('ar', ar)):
    json.dump(dict(sorted(d.items())), open(f'{root}/{name}.json', 'w'), ensure_ascii=False, indent=0)
    open(f'{root}/{name}.json', 'a').write('\n')
print('en', len(en), 'ar', len(ar))
