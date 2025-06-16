import type { ReactElement } from "react";
import { SearchElement } from "../search-element/search-element";
import "./items-page.css";
import type { ItemsView, MemberName } from "../../data/api";

export const ItemsPage = ({ items }: { items?: ItemsView }): ReactElement => {
  const itemComponents: ReactElement[] = [];
  (items ?? []).forEach((quantityByMemberName, itemID) => {
    let totalQuantity = 0;
    const quantityBreakdown = [...quantityByMemberName].map(([name, quantity]: [MemberName, number]) => {
      totalQuantity += quantity;
      return (
        <li key={name}>
          {name}: {quantity}
        </li>
      );
    });

    itemComponents.push(
      <div key={itemID}>
        ID: {itemID} <br />
        Total: {totalQuantity}
        <ul>{quantityBreakdown}</ul>
      </div>,
    );
  });

  return (
    <>
      <div className="items-page__head">
        <SearchElement className="items-page__search" placeholder="Search" auto-focus />
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
          <select className="items-page__player-filter"></select>
        </div>
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <input type="checkbox" id="items-page__individual-items" />
          <label htmlFor="items-page__individual-items">Individual item price</label>
        </div>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <span className="items-page__item-count">0</span>&nbsp;<span>items</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          HA:&nbsp;<span className="items-page__total-ha-price">0</span>
          <span>gp</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          GE:&nbsp;<span className="items-page__total-ge-price">0</span>
          <span>gp</span>
        </span>
      </div>
      <section className="items-page__list">{itemComponents}</section>
    </>
  );
};
