import { type ReactElement, Fragment, useState } from "react";
import { SearchElement } from "../search-element/search-element";
import "./items-page.css";
import type { GEPrices, ItemID, ItemsView, MemberName } from "../../data/api";
import type { ItemData } from "../../data/item-data";

type ItemFilter = "All" | MemberName;
const ItemSortCategory = [
  "Total Quantity",
  "HA Total Value",
  "HA Unit Value",
  "GE Total Price",
  "GE Unit Price",
  "Alphabetical",
] as const;
type ItemSortCategory = (typeof ItemSortCategory)[number];

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

  if (itemCount > 0 && pageCurrent >= pageCount) setPageCurrent(0);

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
  const [sortCategory, setSortCategory] = useState<ItemSortCategory>("GE Unit Price");

  interface ItemAggregates {
    totalHighAlch: number;
    totalGEPrice: number;
    filteredItems: {
      itemID: ItemID;
      itemName: string;
      quantityByMemberName: Map<MemberName, number>;
      totalQuantity: number;
      gePrice: number;
      highAlch: number;
    }[];
  }
  const { totalHighAlch, totalGEPrice, filteredItems } = [...(items ?? [])].reduce<ItemAggregates>(
    (previousValue, [itemID, quantityByMemberName]) => {
      let filteredTotalQuantity = 0;
      const filteredQuantities = new Map<MemberName, number>();
      quantityByMemberName.forEach((quantity, name) => {
        if (filter !== "All" && filter !== name) return;

        filteredQuantities.set(name, quantity);
        filteredTotalQuantity += quantity;
      });

      if (filteredTotalQuantity <= 0) return previousValue;

      const item = itemData?.get(itemID);

      const highAlch = item?.highalch ?? 0;
      const gePrice = gePrices?.get(itemID) ?? 0;
      previousValue.totalHighAlch += filteredTotalQuantity * highAlch;
      previousValue.totalGEPrice += filteredTotalQuantity * gePrice;

      previousValue.filteredItems.push({
        itemID,
        itemName: item?.name ?? "@UNKNOWN",
        quantityByMemberName: filteredQuantities,
        totalQuantity: filteredTotalQuantity,
        gePrice,
        highAlch,
      });

      return previousValue;
    },
    { totalHighAlch: 0, totalGEPrice: 0, filteredItems: [] },
  );

  const { pageNumber, element: pageSelection } = usePageSelection({ itemCount: filteredItems.length });

  const fromIndex = pageNumber * ITEMS_PER_PAGE;
  const toIndex = (pageNumber + 1) * ITEMS_PER_PAGE;

  const renderedPanels = filteredItems
    .sort((lhs, rhs) => {
      switch (sortCategory) {
        case "Total Quantity":
          return rhs.totalQuantity - lhs.totalQuantity;
        case "HA Total Value":
          return rhs.highAlch * rhs.totalQuantity - lhs.highAlch * lhs.totalQuantity;
        case "HA Unit Value":
          return rhs.highAlch - lhs.highAlch;
        case "GE Total Price":
          return rhs.gePrice * rhs.totalQuantity - lhs.gePrice * lhs.totalQuantity;
        case "GE Unit Price":
          return rhs.gePrice - lhs.gePrice;
        case "Alphabetical":
          return lhs.itemName.localeCompare(rhs.itemName);
      }
    })
    .filter((_, index) => index >= fromIndex && index < toIndex)
    .map(({ gePrice, highAlch, itemID, itemName, quantityByMemberName, totalQuantity }) => (
      <ItemPanel
        key={itemID}
        imageURL={`/icons/items/${itemID}.webp`}
        totalQuantity={totalQuantity}
        highAlchPer={highAlch}
        gePricePer={gePrice}
        filter={filter}
        itemName={itemName}
        quantities={quantityByMemberName}
      />
    ));

  return (
    <>
      <div className="items-page__head">
        <SearchElement className="items-page__search" placeholder="Search" auto-focus />
        {pageSelection}
      </div>
      <div className="items-page__utility">
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select
            className="items-page__sort"
            onChange={(e) => {
              setSortCategory(e.target.value as ItemSortCategory);
            }}
          >
            {ItemSortCategory.map((category) => (
              <option selected={category === sortCategory} value={category}>
                Sort: {category}
              </option>
            ))}
          </select>
        </div>
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select
            className="items-page__player-filter"
            onChange={(e) => {
              setFilter(e.target.value as ItemFilter);
            }}
          >
            {["All", ...(memberNames ?? [])].map((name) => (
              <option value={name}>{name}</option>
            ))}
          </select>
        </div>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <span className="items-page__item-count">{filteredItems.length.toLocaleString()}</span>&nbsp;
          <span>items</span>
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
      <section className="items-page__list">{renderedPanels}</section>
    </>
  );
};
