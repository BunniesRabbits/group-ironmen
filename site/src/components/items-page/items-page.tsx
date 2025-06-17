import { type ReactElement, Fragment, useState } from "react";
import { SearchElement } from "../search-element/search-element";
import "./items-page.css";
import type { GEPrices, ItemsView, MemberName } from "../../data/api";
import type { ItemData } from "../../data/item-data";

type ItemFilter = "All" | MemberName;

const ItemPanel = ({
  itemName,
  highAlchPer,
  gePricePer,
  imageURL,
  totalQuantity,
  filter,
  quantities,
}: {
  itemName: string;
  highAlchPer: number;
  gePricePer: number;
  imageURL: string;
  totalQuantity: number;
  filter: ItemFilter;
  quantities: Map<MemberName, number>;
}): ReactElement => {
  const quantityBreakdown = [...quantities].map(([name, quantity]: [MemberName, number]) => {
    if (filter !== "All" && filter !== name) return;

    const className = quantity <= 0 ? "inventory-item__no-quantity" : "";
    const quantityPercent = (quantity / totalQuantity) * 100;
    return (
      <Fragment key={name}>
        <span className={className}>{name}</span>
        <span>{quantity}</span>
        <div
          className="inventory-item__quantity-bar"
          style={{ transform: `scaleX(${quantityPercent}%)`, background: `hsl(${quantityPercent}, 100%, 40%)` }}
        ></div>
      </Fragment>
    );
  });

  const highAlch = highAlchPer * totalQuantity;
  const gePrice = gePricePer * totalQuantity;

  return (
    <div className="inventory-item rsborder rsbackground rendered">
      <div className="inventory-item__top rsborder-tiny">
        <div className="inventory-item__top-right">
          <div className="inventory-item__name">
            <a className="rstext" href="${item.wikiLink}" target="_blank">
              {itemName}
            </a>
          </div>
          <div className="inventory-item__details">
            <span>Quantity</span>
            <span>{totalQuantity.toLocaleString()}</span>
            <span>High Alch</span>
            <span>{highAlchPer.toLocaleString()}gp</span>
            <span>Total</span>
            <span>{highAlch.toLocaleString()}gp</span>
            <span>GE Price</span>
            <span>{gePricePer.toLocaleString()}gp</span>
            <span>Total</span>
            <span>{gePrice.toLocaleString()}gp</span>
          </div>
        </div>

        <div className="inventory-item__picture-container">
          <img
            loading="lazy"
            alt={itemName ?? "An unknown item"}
            className="inventory-item__picture"
            src={imageURL}
            width="63"
            height="56"
          />
        </div>
      </div>
      <div className="inventory-item__bottom">{quantityBreakdown}</div>
    </div>
  );
};

const ITEMS_PER_PAGE = 100;
const usePageSelection = ({
  itemCount,
}: {
  itemCount: number;
}): { pageNumber: number; resetPage: () => void; element: ReactElement } => {
  const [pageCurrent, setPageCurrent] = useState<number>(0);

  const pageCount = Math.ceil(itemCount / ITEMS_PER_PAGE);

  if (pageCurrent >= pageCount) setPageCurrent(0);

  const buttons = [];
  for (let page = 0; page < pageCount; page += 1) {
    buttons.push(
      <button
        key={page}
        onClick={() => {
          setPageCurrent(page);
        }}
        className={`${pageCurrent === page ? "active" : ""} inventory-pager__button men-button`}
      >
        {page + 1}
      </button>,
    );
  }
  const element = (
    <div id="inventory-pager">
      <div className="inventory-pager__label">Page:</div>
      <div className="inventory-pager__buttons">{buttons}</div>
    </div>
  );
  return { pageNumber: pageCurrent, resetPage: () => setPageCurrent(0), element };
};

export const ItemsPage = ({
  items,
  itemData,
  gePrices,
  memberNames,
}: {
  items?: ItemsView;
  itemData?: ItemData;
  gePrices?: GEPrices;
  memberNames?: MemberName[];
}): ReactElement => {
  // const [itemCount, setItemCount] = useState<number>(0);
  const [filter, setFilter] = useState<ItemFilter>("All");

  const filteredItems: ItemsView = new Map();
  let itemCount = 0;
  items?.forEach((quantityByMemberName, itemID) => {
    if (filter !== "All" && (quantityByMemberName.get(filter) ?? 0) <= 0) return;

    filteredItems.set(itemID, quantityByMemberName);
    itemCount += 1;
  });

  const { pageNumber, element: pageSelection } = usePageSelection({ itemCount });

  const itemComponents: ReactElement[] = [];
  let totalItems = 0;
  let totalHighAlch = 0;
  let totalGEPrice = 0;
  const fromIndex = pageNumber * ITEMS_PER_PAGE;
  const toIndex = (pageNumber + 1) * ITEMS_PER_PAGE;

  let index = 0;
  filteredItems.forEach((quantityByMemberName, itemID) => {
    const item = itemData?.get(itemID);

    let totalQuantity = 0;
    quantityByMemberName.forEach((quantity, name) => {
      if (filter !== "All" && name !== filter) return;

      totalQuantity += quantity;
    });

    const highAlch = item?.highalch ?? 0;
    const gePrice = gePrices?.get(itemID) ?? 0;
    totalItems += 1;
    totalHighAlch += totalQuantity * highAlch;
    totalGEPrice += totalQuantity * gePrice;

    if (index >= toIndex || index < fromIndex) {
      index += 1;
      return;
    }

    itemComponents.push(
      <ItemPanel
        key={itemID}
        imageURL={`/icons/items/${itemID}.webp`}
        totalQuantity={totalQuantity}
        highAlchPer={highAlch}
        gePricePer={gePrice}
        filter={filter}
        itemName={item?.name ?? "UNKNOWN"}
        quantities={quantityByMemberName}
      />,
    );

    index += 1;
  });
  return (
    <>
      <div className="items-page__head">
        <SearchElement className="items-page__search" placeholder="Search" auto-focus />
        {pageSelection}
      </div>
      <div className="items-page__utility">
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select className="items-page__sort">
            <option value="totalquantity">Sort: Total Quantity</option>
            <option value="highalch">Sort: High Alch</option>
            <option value="geprice">Sort: GE Price</option>
            <option value="alphabetical">Sort: Alphabetical</option>
          </select>
        </div>
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select
            className="items-page__player-filter"
            onChange={(e) => {
              setFilter(e.target.value as MemberName);
            }}
          >
            {["All", ...(memberNames ?? [])].map((name) => (
              <option value={name}>{name}</option>
            ))}
          </select>
        </div>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <span className="items-page__item-count">{totalItems.toLocaleString()}</span>&nbsp;<span>items</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          HA:&nbsp;<span className="items-page__total-ha-price">{totalHighAlch.toLocaleString()}</span>
          <span>gp</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          GE:&nbsp;<span className="items-page__total-ge-price">{totalGEPrice.toLocaleString()}</span>
          <span>gp</span>
        </span>
      </div>
      <section className="items-page__list">{itemComponents}</section>
    </>
  );
};
