import '@logseq/libs';

interface propsObject {
    icon?: string;
}

const getPageProps = async (title: string): Promise<propsObject> => {
    title = title.toLowerCase();
    let pageProps: propsObject = Object.create(null);
    const iconQuery = `
    [
      :find ?props
      :where
          [?id :block/name "${title}"]
          [?id :block/properties ?props]
    ]
    `;
    const queryResultArr = await logseq.DB.datascriptQuery(iconQuery);
    if (
        queryResultArr[0] &&
        queryResultArr[0][0] &&
        queryResultArr[0][0].icon
    ) {
        pageProps.icon = queryResultArr[0][0].icon;
    }
    return pageProps;
};

const getAliasedPageTitle = async (title: string): Promise<string> => {
    title = title.toLowerCase();
    let aliasedPageTitle = '';
    const inheritedAliasQuery = `
    [
        :find ?origtitle
        :where
            [?id :block/name "${title}"]
            [?origid :block/alias ?id]
            [?origid :block/name ?origtitle]
    ]
    `;
    const aliasArr = await logseq.DB.datascriptQuery(inheritedAliasQuery);
    if (aliasArr.length) {
        aliasedPageTitle = aliasArr[0][0];
    }
    return aliasedPageTitle;
};
const getAliasedPageProps = async (pageTitle: string): Promise<propsObject> => {
    let pageProps: propsObject = Object.create(null);
    const aliasedPageTitle = await getAliasedPageTitle(pageTitle);
    if (aliasedPageTitle) {
        pageProps = await getPageProps(aliasedPageTitle);
    }
    return pageProps;
};

const getPropsByPageName = async (pageTitle: string): Promise<propsObject> => {
    let resultedPageProps: propsObject = Object.create(null);
    // get from own page
    let pageProps = await getPageProps(pageTitle);
    if (pageProps) {
        resultedPageProps = { ...pageProps };
    }
    if (!resultedPageProps['icon'] || !resultedPageProps['color']) {
        // get from aliased page
        pageProps = await getAliasedPageProps(pageTitle);
        if (pageProps) {
            resultedPageProps = { ...pageProps, ...resultedPageProps };
        }
    }
    resultedPageProps = { ...resultedPageProps };
    //@ts-ignore
    resultedPageProps.__proto__ = null;
    return resultedPageProps;
};

const isEmoji = (text: string): boolean => {
    const regex_emoji =
        /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/u;
    return regex_emoji.test(text);
};
const setIconToLinkItem = async (
    linkItem: HTMLElement,
    pageProps: propsObject
) => {
    const pageIcon = pageProps['icon'];
    if (pageIcon && pageIcon !== 'none') {
        const oldPageIcon = linkItem.querySelector('.page-icon');
        oldPageIcon && oldPageIcon.remove();
        linkItem.insertAdjacentHTML(
            'afterbegin',
            `<span class="page-icon" data-is-emoji="${isEmoji(pageIcon)}">${pageIcon} </span>`
        );
    }
};
const processLinkItem = async (linkItem: HTMLElement) => {
    const linkText = linkItem.textContent;
    if (linkText && !linkText.startsWith(' ')) {
        const pageTitle =
            linkItem.getAttribute('data-ref') ||
            linkItem.childNodes[1]?.textContent?.trim() ||
            linkItem.textContent?.trim() ||
            '';
        if (pageTitle) {
            const pageProps = await getPropsByPageName(pageTitle);
            if (pageProps) {
                setIconToLinkItem(linkItem, pageProps);
            }
        }
    }
};

const pageLinksSelector =
    '.page-ref:not(.page-property-key), .tag, .references li a';
const processLinkItems = (node: Document | Element) => {
    const pageLinksList = [...node.querySelectorAll(pageLinksSelector)];
    for (let i = 0; i < pageLinksList.length; i++) {
        const linkItem = pageLinksList[i];
        processLinkItem(linkItem as HTMLElement);
    }
};
const main = async () => {
    const doc = parent.document;
    const appContainer = doc.getElementById('app-container')!;

    const extLinksObserverConfig = { childList: true, subtree: true };
    const extLinksObserver = new MutationObserver((mutationsList, observer) => {
        for (const element of mutationsList) {
            const addedNode = element.addedNodes[0] as Element;
            if (addedNode?.childNodes.length) {
                processLinkItems(addedNode);
            }
        }
    });
    setTimeout(() => {
        processLinkItems(doc);
        extLinksObserver.observe(appContainer, extLinksObserverConfig);
    }, 500);
};

logseq.ready(main).catch(console.error);
