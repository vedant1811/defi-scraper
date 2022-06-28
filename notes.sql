# as default user:

CREATE USER amm_scraper WITH PASSWORD 'password';
CREATE DATABASE amm_scraper OWNER amm_scraper;

# as amm_scraper user


CREATE UNIQUE INDEX price_uniqueness_composite ON price ("chain", "poolAddress", "blockNumber");


SELECT * FROM price WHERE "blockTimestamp" > timezone('UTC', to_timestamp(1655958656)) ORDER BY "blockTimestamp";

SELECT * FROM price WHERE "blockTimestamp" >= '2022-06-23 04:09:33' ORDER BY "blockTimestamp";
