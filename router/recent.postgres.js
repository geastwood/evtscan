const postgres = require('../lib/postgres.js');

// lower priority of Test Fungibles
// const lowerTest = true;

Array.prototype.mapAsync = async function (fn) {
    let newArr = [];
    for (let i in this) Number.isInteger(parseInt(i, 10)) && (newArr.push(await fn(this[i], i)));
    return newArr;
}

// get most recent transactions from mongo
const getRecent = (fn, patched) => async (ctx, next) => {

    let {since, page, size, from, block_id, trx_id, trx_name, creator, key, name, sym_id, filter} = ctx.query;
    const params = {...patched};

    // check params of input
    if (!(since = Date.parse(since))) since = Date.now();
    if (!(from = Date.parse(from))) from = new Date(0).getTime();
    if (isNaN(page = parseInt(page, 10))) page = 0;
    else if (page < 0) page = 0;
    if (!(size = parseInt(size, 10))) size = 10;
    else if (size < 10) size = 10;
    if (block_id) params.block_id = block_id;
    if (trx_id) params.trx_id = trx_id;
    if (trx_name) params.trx_name = trx_name;
    if (creator) params.creator = creator;
    if (key) params.key = key;
    if (name) params.name = name;
    if (!isNaN(sym_id = parseInt(sym_id, 10))) params.sym_id = sym_id;
    else params.sym_id = -1;
    if (filter) params.filter = filter;

    // set return content of query
    ctx.type = 'application/json';
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Methods', 'GET, OPTION');
    
    let result = {
        state: 1,
        since, page, size, from,
        data: await fn(since, page, size, from, params)
    };

    if (!result.data) result = { state: 0, error: "resource not found" }
    ctx.body = result;
    
}

const getBlocks = async (since, page, size, from, {trx_id}) => {
    let res = await postgres.db(async db => {
        return (await db.query(`SELECT * FROM blocks WHERE timestamp<=$1 AND timestamp>=$2 ORDER BY block_num DESC LIMIT $3 OFFSET $4`, [new Date(since), new Date(from), size, size * page])).rows || [];
    });
    return res[1] || [];
}

const getTransactions = async (since, page, size, from, {block_id}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        let queries = [new Date(since), new Date(from), size, size * page];
        if (block_id) { addons = `AND block_id=$5`; queries.push(block_id); }
        return (await db.query(`SELECT * FROM transactions WHERE timestamp<=$1 AND timestamp>=$2 ${addons} ORDER BY timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
    });
    return res[1] || [];
}

const getActions = async (since, page, size, from, {trx_id, sym_id}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        let queries = [new Date(since), new Date(from), size, size * page];
        if (trx_id) { addons = `AND a.trx_id=$5`; queries.push(trx_id); }
        else if (sym_id) { addons = `AND a.domain=$5 AND a.key=$6`; queries.push(".fungible"); queries.push(sym_id); }
        return (await db.query(`SELECT a.*, t.timestamp AS timestamp FROM actions a INNER JOIN transactions t ON a.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        // return (await db.query(`SELECT a.*, t.timestamp AS timestamp FROM actions a INNER JOIN transactions t ON a.trx_id = t.trx_id WHERE $1=$1 AND $2=$2 ${addons} ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
    });
    return res[1] || [];
}

const getTrxByName = async (since, page, size, from, {trx_name="everipay"}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        let queries = [new Date(since), new Date(from), size, size * page];
        if (trx_name) { addons = `AND name=$5`; queries.push(trx_name); }
        // let actionsData = (await db.query(`SELECT a.*, t.timestamp AS timestamp FROM actions a INNER JOIN transactions t ON a.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        let actionsData = (await db.query(`SELECT a.*, t.timestamp AS timestamp FROM actions a INNER JOIN transactions t ON a.trx_id = t.trx_id WHERE $1=$1 AND $2=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        
        let trxMap = {};
        actionsData.forEach(a => {
            a.data.key = a.data.link && a.data.link.keys && a.data.link.keys[0] || "";
            delete a.data.link;
            trxMap[a.trx_id] = a;
        });
        let trxs = actionsData.map(a => a.trx_id);
        let params = trxs.map((_, i) => `$${i+1}`);
        let ans = (await db.query(`SELECT * FROM transactions WHERE trx_id IN (${params.join(",")}) ORDER BY timestamp DESC`, trxs)).rows || [];
        return ans.map(a => ({...a, data: trxMap[a.trx_id].data || {}, domain: trxMap[a.trx_id].domain || {}}));
    });
    return res[1] || [];
}

const getFungibles = async (since, page, size, from, {creator, filter}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        // let queries = [new Date(since), new Date(from), size, size * page];
        let queries = [size, size * page];
        // let startIndex = 5;
        let startIndex = 3;
        // if (creator) { addons = `AND creator=$5`; queries.push(creator); startIndex += 1; }
        if (creator) { addons = `WHERE creator=$3`; queries.push(creator); startIndex += 1; }
        if (filter) {
            if (addons) addons += ' AND ';
            else addons += ' WHERE ';
            addons += `(LOWER(name) LIKE $${startIndex} OR LOWER(sym_name) LIKE $${startIndex} OR sym_id=$${startIndex+1})`;
            queries.push(`%${filter.trim().toLocaleLowerCase()}%`);
            queries.push(parseInt(filter, 10) || -1);
        }
        // let schemaResult = (await db.query(`SELECT f.*, t.timestamp AS timestamp FROM fungibles f INNER JOIN transactions t ON f.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        const schemaResult = (await db.query(`SELECT f.*, t.timestamp AS timestamp FROM fungibles f INNER JOIN transactions t ON f.trx_id = t.trx_id ${addons} ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`, queries)).rows || [];
        const metasSet = new Set();
        schemaResult.forEach(d => {
            if (d && d.metas && d.metas.length) d.metas.forEach(o => metasSet.add(o));
        });
        const metasArr = Array.from(metasSet);
        const metasMap = {};
        // let metasCount = 0; ((await db.query(`SELECT * FROM metas WHERE id IN (${metasArr.map(() => `$${++metasCount}`).join(",")})`, metasArr)).rows || [])
        ((await db.query(`SELECT * FROM metas WHERE id=any($1)`, [metasArr])).rows || [])
            .forEach(m => {
                metasMap[m.id] = m;
            });
        return schemaResult.map(d => {
            if (d && d.metas && d.metas.length) {
                d.metas = d.metas.map(id => metasMap[id] || null).filter(Boolean);
            }
            return d;
        });
    });
    return res[1] || [];
}

const getDomains = async (since, page, size, from, {creator}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        let queries = [new Date(since), new Date(from), size, size * page];
        if (creator) { addons = `AND creator=$5`; queries.push(creator); }
        // return (await db.query(`SELECT d.*, t.timestamp AS timestamp FROM domains d INNER JOIN transactions t ON d.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        return (await db.query(`SELECT d.*, t.timestamp AS timestamp FROM domains d INNER JOIN transactions t ON d.trx_id = t.trx_id WHERE $1=$1 OR $2=$2 ${addons} ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
    });
    return res[1] || [];
}

const getGroups = async (since, page, size, from, {key}) => {
    let res = await postgres.db(async db => {
        let addons = "";
        let queries = [new Date(since), new Date(from), size, size * page];
        if (key) { addons = `AND def=$5`; queries.push(key); }
        // return (await db.query(`SELECT g.*, t.timestamp AS timestamp FROM groups g INNER JOIN transactions t ON g.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 ${addons} ORDER BY t.timestamp DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
        return (await db.query(`SELECT g.*, t.timestamp AS timestamp FROM groups g INNER JOIN transactions t ON g.trx_id = t.trx_id WHERE $1=$1 OR $2=$2 ${addons} ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`, queries)).rows || [];
    });
    return res[1] || [];
}

const getNonfungibles = async (since, page, size, from) => {
    let res = await postgres.db(async db => {
        // return (await db.query(`SELECT tk.domain AS _id, COUNT(*) AS count, MAX(t.timestamp) AS updated_at FROM tokens tk INNER JOIN transactions t ON tk.trx_id = t.trx_id WHERE t.timestamp<=$1 AND t.timestamp>=$2 GROUP BY _id ORDER BY updated_at DESC LIMIT $3 OFFSET $4`, [new Date(since), new Date(from), size, size * page])).rows || [];
        return (await db.query(`SELECT tk.domain AS _id, COUNT(*) AS count, MAX(t.timestamp) AS updated_at FROM tokens tk INNER JOIN transactions t ON tk.trx_id = t.trx_id GROUP BY _id ORDER BY updated_at DESC LIMIT $1 OFFSET $2`, [size, size * page])).rows || [];
    });
    return res[1] || [];
}

module.exports = [
    ['get', '/block', getRecent(getBlocks)],
    ['get', '/transaction', getRecent(getTransactions)],
    ['get', '/action', getRecent(getActions)],
    ['get', '/trxByName', getRecent(getTrxByName)],
    ['get', '/fungible', getRecent(getFungibles)],
    ['get', '/domain', getRecent(getDomains)],
    ['get', '/group', getRecent(getGroups)],
    ['get', '/nonfungible', getRecent(getNonfungibles)],
    ['get', '/everipay', getRecent(getTrxByName, {trx_name: "everipay"})],
    ['get', '/everipass', getRecent(getTrxByName, {trx_name: "everipass"})],
];