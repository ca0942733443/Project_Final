# Database schema files

- `pro.corrected.sql` is the canonical schema loaded by `server/scripts/init-db.ts`.
- `seed_products.sql` is optional development/demo data and expects the canonical schema.
- `captain_kai_sod_db_workbench.sql` is an older Workbench export kept only for reference; it predates subcategories.
- `schema.sql` is an older, incompatible prototype schema and must not be loaded into the application database.
- `backup.sql` is intentionally not a data backup.

## Category relationships

The application uses three explicit levels: `categories` (main), `sub_categories` (child), and `sub_sub_categories` (optional third level). Products reference their main category through `products.category_id` and their optional child through `products.sub_category_id`. Foreign keys keep both links valid. The `categories` table does not use a self-referencing `parent_id` column.

Database initialization removes a legacy `categories.parent_id` only if every value is `NULL`. If it contains hierarchy data, initialization stops rather than dropping or silently remapping it. Invalid product subcategory ids are cleared only when adding the `products.sub_category_id` foreign key; each product retains its main category.
