export const showListNames = ['Transactions', 'Blocks', 'Fungibles', 'Nonfungibles', 'Domains', 'Groups'];
export const showListIds = ['trx', 'block', 'fungible', 'nonfungible', 'domain', 'group'];

export const parseKey = function (key = "") {
    return key.split("_").map(it => it[0].toLocaleUpperCase() + it.substr(1)).join(" ");
}

export const makeLink = function (source, key, route) {
    if (!source || !source[key]) return;
    source[key] = {
        hide: true,
        content: source[key],
        type: "innerLink",
        data: `/${route}/${source[key]}`
    };
}

export const msToTimeStr = function (time=0, fix=true) {

    let timeStr = 's';
    time = parseInt(time, 10) || 0;
    if (fix && time < 0) time = 0;

    // show percent of time if time is less than 60s
    if (time < 60 * 1000) return `${Math.floor(time / 10) / 100} secs`;
    else time = Math.floor(time / 1000);
    
    // show hhmmss of time
    timeStr = (time % 60) + timeStr;
    time = Math.floor(time / 60);
    if (time <= 0) return timeStr;
    else timeStr = "m " + timeStr;
    // else timeStr = "mins";

    timeStr = (time % 60) + timeStr;
    time = Math.floor(time / 60);
    if (time <= 0) return timeStr;
    else timeStr = time + "h " + timeStr;
    // else timeStr = time + "hours";

    return timeStr;

}

export const tablizeBlock = function (data={}) {

    let res = [];
    delete data._id;
    delete data.created_at;

    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    return  res;

}

export const tablizeBlockTrx = function (data=[]) {

    let res = [];

    data.forEach(d => {
        res.push([d.trx_id, d.pending, d.timestamp]);
    });

    return  res;

}

export const tablizeTrx = function (data={}) {

    let res = [];
    delete data._id;
    delete data.created_at;
    delete data.expiration;
    delete data.seq_num;
    delete data.action_count;

    let trace = data.trace;
    delete data.trace;
    if (trace) {
        data["Trace.Elapsed"] = trace.elapsed + " us";
        data["Trace.Charge"]  = trace.charge / 10e4 + " EVT/PEVT";
    } else if ('change' in data && 'elapsed' in data) {
        data["Trace.Elapsed"] = data.elapsed + " us";
        data["Trace.Charge"]  = data.charge / 10e4 + " EVT/PEVT";
    }

    let { keys, signatures } = data;
    delete data.keys;
    delete data.signatures;

    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    keys = (keys || []).map(k => [k]);
    signatures = (signatures || []).map(k => [k]);

    return [res, keys, signatures];

}

export const tablizeTrxAction = function (data=[]) {

    let res = [];
    let resData = [];

    data.sort((a, b) => a.seq_num > b.seq_num ? 1 : -1);

    data.forEach(d => {
        res.push([d.seq_num, d.name, d.domain, d.key]);
        resData.push(d.data);
    });

    return [res, resData];

}

export const tablizeFungible = function (data={}) {

    let res = [];
    delete data._id;
    delete data.created_at;

    let detailedData = [];
    let detailedActions = [];
    [data.issue || null, data.manage || null, data.transfer || null].forEach(d => {
        if (!d) return;
        detailedData.push([d.name, d.threshold, d.authorizers ? (d.authorizers.length || 0) : 0]);
        detailedActions.push(d);
    });
    delete data.issue;
    delete data.manage;
    delete data.transfer;

    let metaData = {};
    if (!data.metas || !data.metas.length) metaData = null;
    else (data.metas || []).forEach(m => {
        metaData[m.key] = m;
    });
    delete data.metas;

    if (data.total_supply) data.total_supply = (parseInt(data.total_supply, 10) || "N/A").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (data.current_supply) data.current_supply = (parseInt(data.current_supply, 10) || "N/A").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    return [res, detailedData, detailedActions, metaData];

}

export const tablizeNonfungible = function (data={}) {

    let res = [];
    delete data._id;

    if (data.data && data.data.name) data.name = data.data.name;
    if (data.data && data.data.creator) data.creator = data.data.creator;
    if (typeof data.seq_num !== "undefined") data.seq_num = `${data.seq_num} `;

    let detailedData = [];
    let detailedActions = [];
    let iData = data.data || {};
    [iData.issue || null, iData.transfer || null, iData.manage || null].forEach(d => {
        if (!d) return;
        detailedData.push([d.name, d.threshold, d.authorizers ? (d.authorizers.length || 0) : 0]);
        detailedActions.push(d);
    });
    delete data.data;

    let distributeData = data.distributes || null;
    delete data.distributes;

    data.created_by_trx = {
        hide: true,
        content: data.trx_id,
        type: "innerLink",
        data: `/trx/${data.trx_id}`
    };
    delete data.trx_id;
    delete data.created_at;
    delete data.key;

    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    return [res, detailedData, detailedActions, distributeData];

}

export const tablizeNonfungibleToken = function (data={}) {

    const res = [];

    const metas = [];
    const metaData = data.metas || [];
    delete data.metas;
    metaData.forEach(m => {
        metas.push([m.id, m.key, m.creator, m.created_at]);
    });

    makeLink(data, 'trx_id', 'trx');
    makeLink(data, 'domain', 'nonfungible');

    for (let key in data) {
        if (key === 'owner') {
            let isFirst = true;
            (data[key] || []).forEach(owner => {
                res.push([isFirst ? parseKey(key) : '', {
                    hide: true,
                    content: owner,
                    type: "innerLink",
                    data: `/address/${owner}`
                }]);
                isFirst = false;
            });
        } else {
            res.push([parseKey(key), data[key]]);
        }
    }

    return [res, metas, metaData];

}

export const tablizeDomain = function (data={}) {

    let res = [];
    delete data._id;
    delete data.created_at;

    let detailedData = [];
    let detailedActions = [];
    [data.issue || null, data.transfer || null, data.manage || null].forEach(d => {
        if (!d) return;
        detailedData.push([d.name, d.threshold, d.authorizers ? (d.authorizers.length || 0) : 0]);
        detailedActions.push(d);
    });
    delete data.issue;
    delete data.manage;
    delete data.transfer;

    let metaData = {};
    if (!data.metas || !data.metas.length) metaData = null;
    else (data.metas || []).forEach(m => {
        metaData[m.key] = m;
    });
    delete data.metas;

    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    return [res, detailedData, detailedActions, metaData];

}

export const tablizeGroup = function (data={}) {

    let res = [];
    delete data._id;
    delete data.created_at;

    data = {...data, ...data.def};
    data.threshold = data.threshold || (data.root || {}).threshold || 0;
    delete data.def;

    let detailedData = [];
    let detailedActions = [];
    ((data.root || data).nodes || []).forEach(d => {
        if (!d || !d.weight) return;
        detailedData.push([d.weight, d.key || "Group"]);
        detailedActions.push(d);
    });
    delete data.root;
    data.nodes = detailedData.length;

    let metaData = {};
    if (!data.metas || !data.metas.length) metaData = null;
    else (data.metas || []).forEach(m => {
        metaData[m.key] = m;
    });
    delete data.metas;

    for (let key in data) {
        res.push([parseKey(key), data[key]]);
    }

    return [res, detailedData, detailedActions, metaData];

}

export const tablizeAddress = function (data={}) {

    return Object.keys(data).map(key => ([key.split("-").map(it => it[0].toLocaleUpperCase() + it.substr(1)).join(" "), data[key]]));

}

export const tablizeAddressAssets = function (data=[]) {

    return data.map(d => ([d.name, d.sym_id, d.amount])).filter(Boolean);

}

export const tablizeHistory = function (data=[]) {

    let res = [];

    res = data.map(d => {
        delete d._id;
        return [d.name, d.domain, d.key, d.trx_id, d.timestamp];
    });

    return [res, data];

}

export const tablizeBlocks = function (data=[]) {

    let res = [];
    let resData = [];

    data.forEach(d => {
        res.push([d.block_num, d.block_id, d.producer, d.timestamp]);
        resData.push('/block/' + d.block_id);
    });

    return [res, resData];

}

export const tablizeTransactions = function (data=[]) {

    let res = [];
    let resData = [];

    data.forEach(d => {
        res.push([d.trx_id, d.block_num, {content: `${d.pending}`, color:d.pending ? "green" : "red"}, d.timestamp]);
        resData.push('/trx/' + d.trx_id);
    });

    return [res, resData];

}

export const tablizeFungibles = function (data=[]) {

    let res = [];
    let resData = [];

    data.forEach(d => {
        let firstEle = d.name;
        if (d.metas && Object.keys(d.metas).length) {
            Object.keys(d.metas).forEach(k => {
                if (d.metas[k] && d.metas[k].key === "symbol-icon") {
                    firstEle = {
                        content: d.name, 
                        type: "imageSrc", 
                        data: d.metas[k].value
                    };
                }
            })
            
        }
        res.push([firstEle, d.sym_id, d.creator, d.timestamp]);
        resData.push('/fungible/' + d.sym_id);
    });

    return [res, resData];

}

export const tablizeNonfungibles = function (data=[]) {

    let res = [];
    let resData = [];

    data.forEach(d => {
        if (!d._id || !d.updated_at || typeof d.count === "undefined") return;
        res.push([d._id, d.count, d.updated_at]);
        resData.push('/nonfungible/' + d._id);
    });

    return [res, resData];

}

export const tablizeDomains = function (data=[]) {

    let res = [];
    let resData = [];

    data.forEach(d => {
        res.push([d.name, d.creator, d.timestamp]);
        resData.push('/domain/' + d.name);
    });

    return [res, resData];

}

export const tablizeGroups = function (data=[]) {

    let res = [];
    let resData = [];
    data.forEach(d => {
        let def = d.def || {};
        res.push([d.name, d.key || "None", def.threshold || 0]);
        resData.push('/group/' + d.name);
    });

    return [res, resData];

}

export default {
    showListNames,
    showListIds,
    msToTimeStr,

    tablizeBlock,
    tablizeBlockTrx,
    tablizeTrx,
    tablizeTrxAction,
    tablizeFungible,
    tablizeNonfungible,
    tablizeNonfungibleToken,
    tablizeDomain,
    tablizeGroup,
    tablizeAddress,
    tablizeAddressAssets,
    tablizeHistory,
    tablizeBlocks,
    tablizeTransactions,
    tablizeFungibles,
    tablizeNonfungibles,
    tablizeDomains,
    tablizeGroups,
}