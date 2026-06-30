-- Fusion des rôles "owner" et "admin": migration des enregistrements existants
UPDATE "member" SET "role" = 'admin' WHERE "role" = 'owner';
UPDATE "invitation" SET "role" = 'admin' WHERE "role" = 'owner';

