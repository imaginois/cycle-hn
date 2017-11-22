import { Location } from 'history';
import switchPath from 'switch-path';
import xs, { Stream } from 'xstream';
import isolate from '@cycle/isolate';
import { PageState } from './pages/types';
import FeedsList from './pages/FeedsList';
import { StateSource } from 'cycle-onionify';
import { extractSinks } from 'cyclejs-utils';
import { Sources, Sinks } from './interfaces';
import { VNode, DOMSource } from '@cycle/dom';
import { Routes, MatchedRoute } from './routes';

export const API_URL = 'https://hnpwa.com/api/v0';

export type AppState = {
    page: PageState;
};

const defaultAppState: AppState = {
    page: {} as PageState
};

export type Reducer = (prev?: AppState) => AppState | undefined;
export type AppSinks = Sinks & { onion: Stream<Reducer> };
export type AppSources = Sources & { onion: StateSource<AppState>};

function navigation(pathname: string): VNode {
    return (
        <span>
            <a href="/news/1" className={pathname.startsWith('/news') ? 'active' : ''}> top </a>
            <a href="/newest/1" className={pathname.startsWith('/newest') ? 'active' : ''}> new </a>
            <a href="/show/1" className={pathname.startsWith('/show') ? 'active' : ''}> show </a>
            <a href="/ask/1" className={pathname.startsWith('/ask') ? 'active' : ''}> ask </a>
            <a href="/jobs/1" className={pathname.startsWith('/jobs') ? 'active' : ''}> jobs </a>
        </span>
    );
}

function view(history$: Stream<Location>, vdom$: Stream<VNode>): Stream<VNode> {
    return xs.combine(history$, vdom$).map(([{pathname}, vdom]: [{pathname: string}, VNode]) =>
        <div className="main-wrapper">
            <div className="header-wrapper">
                <div className="header-inner">
                    <a href="/">
                        <img className="logo" src="/public/cycle.png" alt="logo" />
                    </a>
                    <a className="home" href="/news/1">Cycle HN</a>
                    {navigation(pathname)}
                </div>
            </div>
            <div className="main-content">
                {vdom}
            </div>
            <div className="footer">
                <p>Fork project at <a className="github" href="https://github.com/usm4n/cycle-hn">usm4n/cycle-hn</a></p>
            </div>
        </div>
    );
}

function initState(): Stream<Reducer> {
    const initReducer$ = xs.of<Reducer>(
        prevState => (prevState === undefined ? defaultAppState : prevState)
    );

    return initReducer$;
}

export function App(sources: AppSources): AppSinks {
    const history$: Stream<Location> = sources.History;

    const initState$ = initState();

    const pageSinks$ = history$.map((location: Location): MatchedRoute => {
        const {pathname} = location;

        return switchPath(pathname, Routes);
    }).map((route: MatchedRoute) => isolate(route.value, 'page')(sources));

    const pageSinks = extractSinks(pageSinks$, ['DOM', 'HTTP', 'onion']);

    const reducers$ = xs.merge<Reducer>(pageSinks.onion, initState$);

    const vdom$ = view(history$, pageSinks.DOM as Stream<VNode>);

    return {
        DOM: vdom$,
        onion: reducers$,
        HTTP: pageSinks.HTTP
    };
}
