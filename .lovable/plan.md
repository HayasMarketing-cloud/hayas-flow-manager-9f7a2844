

## Plan: Rename PDF filename

Change the `doc.save()` call in `budgetPDFGenerator.ts` (line 267) from:
```
doc.save(`quote_${fileCode}.pdf`);
```
to:
```
doc.save(`Hayas Quote ${fileCode}.pdf`);
```

Single line change, no other files affected.

