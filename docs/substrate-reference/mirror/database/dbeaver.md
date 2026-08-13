<!-- source: https://supabase.com/docs/guides/database/dbeaver · mirrored 2026-08-13 from Supabase docs -->

# Connecting with DBeaver

If you do not have DBeaver, you can download it from its [website](https://dbeaver.io/download/).

1. **Create a new database connection**

Create a new database connection

![new database connection](/docs/img/guides/database/connecting-to-postgres/dbeaver/new_database_connection.png)

2. **Select PostgreSQL**



![Selection Menu](/docs/img/guides/database/connecting-to-postgres/dbeaver/select_postgres.png)

3. **Get Your Credentials**

On your project dashboard, click [Connect](https://supabase.com/dashboard/project/_?showConnect=true), note your session pooler's:

- host
- username

You will also need your database's password. If you forgot it, you can generate a new one in the settings.

Note: If you're in an [IPv6 environment](https://github.com/orgs/supabase/discussions/27034) or have the IPv4 Add-On, you can use the direct connection string instead of Supavisor in Session mode.

![database credentials](/docs/img/guides/database/connecting-to-postgres/dbeaver/session_mode.png)

4. **Fill out credentials**

In DBeaver's Main menu, add your host, username, and password

![filling out form](/docs/img/guides/database/connecting-to-postgres/dbeaver/filling_credentials.png)

5. **Download certificate**

In the [Database Settings](https://supabase.com/dashboard/project/_/database/settings), download your SSL certificate.

![filling out form](/docs/img/guides/database/connecting-to-postgres/dbeaver/certificate.png)

6. **Secure your connection**

In DBeaver's SSL tab, add your SSL certificate

![filling out form](/docs/img/guides/database/connecting-to-postgres/dbeaver/ssl_tab.png)

7. **Connect**

Test your connection and then click finish. You should now be able to interact with your database with DBeaver

![connected dashboard](/docs/img/guides/database/connecting-to-postgres/dbeaver/finished.png)
