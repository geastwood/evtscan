// initialize system time
let time = Date.now();

export const state = () => ({
    open: false,
    time,
});

export const mutations = {
    switchOpen: (state) => {
        state.open = !state.open;
    },
    updateCurrentTime: (state) => {
        state.time = Date.now();
    }
};

export const actions = {};